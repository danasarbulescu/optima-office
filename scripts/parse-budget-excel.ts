/**
 * Parse Budget Excel File
 *
 * Extracts structured budget data from the Russel Fischer FY26 Budget P&L Excel file.
 * Each location tab becomes a separate entity dataset containing:
 *   - Operational metrics (car count, gallons, membership count)
 *   - P&L budget amounts per account per month (Jan–Dec 2026)
 *   - 2025 full-year actuals for variance reference
 *
 * Output: JSON written to scripts/budget-output/ for review before DynamoDB import.
 *
 * Usage:
 *   npx tsx scripts/parse-budget-excel.ts
 *   npx tsx scripts/parse-budget-excel.ts --tab "01 - Huntington Beach"
 */

import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as typeof import('xlsx');

const EXCEL_PATH =
  'C:/Users/danas/OneDrive - Optima Office/Dana internal/Internal/Rocks/2025/Automation Framework/Russel Fischer/Budget_FY26_P&L_v11.19.25 as of 01.06.2026.xlsx';

const LOCATION_TABS = [
  '01 - Huntington Beach',
  '03 - San Clemente',
  '04 - Bella Terra',
  '06 - Huntington Harbor',
  '08 - Santa Ana',
  '09 - 301 Tustin',
  '10 - Corporate',
];

// Months for FY26 budget columns (header row cols 1–12)
const BUDGET_MONTHS = [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
];

// Account code pattern: "4004-00" or "5001-00" etc.
const ACCOUNT_CODE_RE = /^\s*(\d{4}-\d{2}(?:-\d+)?)\s+(.+)$/;

// QuickBooks subtotal / section rows to capture in addition to leaf accounts
const SUBTOTAL_LABELS = new Set([
  'Total Income',
  'Total Cost of Goods Sold',
  'Total Payroll',
  'Gross Profit',
  'Total Expense',
  'Total Other Income',
  'Total Other Expense',
  'Total Net Income',
  'GP %',
]);

// Operational metric row labels — all variants across tabs
// Maps the row label to a clean metric key
const METRIC_ROW_MAP: Record<string, string> = {
  // Membership count (volume metric, monthly series)
  'MEMBERSHIP COUNT':                                      'membershipCount',
  'Membership Sales Budget':                               'membershipCount',

  // Car count (monthly series)
  'Car count budget':                                      'carCount',

  // Total gallons (monthly series)
  '(5% increase over prior year) Monthly Gallons Budget':  'totalGallons',
  '(5% increase over prior) Monthly Gallons Budget':       'totalGallons',
  'Gallons Budget':                                        'totalGallons',

  // Fuel breakdown (monthly or constant)
  'e85 gallons/month':                                     'e85Gallons',
  '87-91 gallons/month':                                   'regularGallons',
  'e85 gallons/cost':                                      'e85Cost',
  '87-91 gallons/cost':                                    'regularCost',

  // Labor % (monthly series — varies by month)
  'Labor COGS % of TOTAL SALES':                           'laborCogsPercent',
  'Labor COGS % of wash sales':                            'laborCogsPercent',
  'Labor COGS % of Wash sales':                            'laborCogsPercent',

  // Assumption/rate scalars (single value, not time-series)
  'Wash/ARM/Detail % increase over 2025':                  'washRevenueIncreasePct',
  'C-Store sales increase':                                'cStoreSalesIncreasePct',
  'C-Store cost of sales':                                 'cStoreCostPct',
  'C-Store cost increase':                                 'cStoreCostIncreasePct',
  'Gallons cost of sales':                                 'gallonsCostPct',
  'Gallons volume per monthincrease 5%':                   'gallonsVolumeIncreasePct',
  'Labor Increase':                                        'laborIncreasePct',
  'Wash sales cost':                                       'washSalesCostPct',
  'Wash detail cost':                                      'washDetailCostPct',
};

type MonthMap = Record<string, number>; // { "2026-01": 121540, ... }

interface MetricSeries {
  key: string;
  label: string;
  /** Monthly values where available, otherwise single constant value under "all" */
  monthly: MonthMap | null;
  /** Single scalar (e.g. cost per gallon, % rate) */
  constant: number | null;
  annualTotal: number | null;
}

interface BudgetLine {
  accountCode: string | null;  // null for subtotals
  accountName: string;
  rowType: 'account' | 'subtotal' | 'section';
  /** Depth derived from leading spaces in original label (0 = top-level) */
  depth: number;
  monthly: MonthMap;
  annualTotal: number | null;
  actuals2025: number | null;
}

interface EntityBudget {
  tabName: string;
  /** Derived slug: "01-huntington-beach" */
  slug: string;
  /** Short display name: "Huntington Beach" */
  displayName: string;
  locationCode: string; // "01", "03", etc.
  fiscalYear: number;
  metrics: MetricSeries[];
  budgetLines: BudgetLine[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (!isNaN(n)) return n;
  }
  return 0;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseTabName(tab: string): { locationCode: string; displayName: string; slug: string } {
  // "01 - Huntington Beach" → { locationCode: "01", displayName: "Huntington Beach", slug: "01-huntington-beach" }
  const m = tab.match(/^(\d+)\s*-\s*(.+)$/);
  if (m) {
    return {
      locationCode: m[1],
      displayName: m[2].trim(),
      slug: `${m[1]}-${slugify(m[2].trim())}`,
    };
  }
  return { locationCode: '00', displayName: tab, slug: slugify(tab) };
}

function rowLabel(row: unknown[]): string {
  return String(row[0] ?? '').trimEnd();
}

function leadingSpaces(s: string): number {
  return s.length - s.trimStart().length;
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

function parseLocationTab(
  rows: unknown[][],
  tabName: string,
): EntityBudget {
  const { locationCode, displayName, slug } = parseTabName(tabName);

  // Find the header row (where col[0] === "Accounts")
  const headerIdx = rows.findIndex(r => String(r[0] ?? '').trim() === 'Accounts');
  if (headerIdx === -1) throw new Error(`No header row found in tab: ${tabName}`);

  // ── Operational metrics (rows above header row) ───────────────────────────
  const metrics: MetricSeries[] = [];
  for (let i = 0; i < headerIdx; i++) {
    const row = rows[i];
    const label = rowLabel(row).trim();
    const metricKey = METRIC_ROW_MAP[label];
    if (!metricKey) continue;

    const vals = (row as unknown[]).slice(1, 13).map(v => num(v));
    const annualCol = num((row as unknown[])[13]);

    // If all monthly values are the same (constant), treat as scalar
    const isConstant = vals.every(v => v === vals[0]);
    const hasMonthly = vals.some(v => v !== 0);

    // For cost/rate rows that are constant across months
    const constant = isConstant && vals[0] !== 0 ? vals[0] : null;

    // Always build monthly map if there are any non-zero values (constant or not)
    const effectiveMonthly: MonthMap | null = hasMonthly
      ? Object.fromEntries(BUDGET_MONTHS.map((mo, idx) => [mo, vals[idx]]))
      : null;

    // Use sum of monthly values for annualTotal (column 13 is unreliable for constant rows)
    const monthlySum = vals.reduce((a, b) => a + b, 0);

    metrics.push({
      key: metricKey,
      label,
      monthly: effectiveMonthly,
      constant,
      annualTotal: monthlySum !== 0 ? monthlySum : annualCol !== 0 ? annualCol : null,
    });
  }

  // ── P&L budget lines (rows after header) ─────────────────────────────────
  const budgetLines: BudgetLine[] = [];
  const dataRows = rows.slice(headerIdx + 1);

  for (const row of dataRows) {
    const raw = rowLabel(row);
    if (!raw) continue;

    const trimmed = raw.trimStart();
    if (!trimmed) continue;

    const depth = Math.floor(leadingSpaces(raw) / 3); // 3-space indent in this file

    // Check if it's a subtotal row
    const isSubtotal = SUBTOTAL_LABELS.has(trimmed);

    // Check if it's a leaf account (has account code)
    const codeMatch = trimmed.match(ACCOUNT_CODE_RE);

    let rowType: BudgetLine['rowType'];
    let accountCode: string | null = null;
    let accountName = trimmed;

    if (codeMatch) {
      rowType = 'account';
      accountCode = codeMatch[1];
      accountName = codeMatch[2].trim();
    } else if (isSubtotal) {
      rowType = 'subtotal';
    } else {
      rowType = 'section';
    }

    const vals = (row as unknown[]).slice(1, 13).map(v => num(v));
    const hasAnyValue = vals.some(v => v !== 0);
    const annualCol = num((row as unknown[])[13]);
    const actuals2025Col = num((row as unknown[])[15]);

    // Skip rows with no budget data and no actuals (pure zero/placeholder rows)
    if (!hasAnyValue && annualCol === 0 && actuals2025Col === 0 && rowType === 'section') continue;
    if (!hasAnyValue && annualCol === 0 && actuals2025Col === 0 && rowType === 'account') continue;

    const monthly = Object.fromEntries(
      BUDGET_MONTHS.map((mo, idx) => [mo, vals[idx]])
    );

    budgetLines.push({
      accountCode,
      accountName,
      rowType,
      depth,
      monthly,
      annualTotal: annualCol !== 0 ? annualCol : hasAnyValue ? vals.reduce((a, b) => a + b, 0) : null,
      actuals2025: actuals2025Col !== 0 ? actuals2025Col : null,
    });
  }

  return {
    tabName,
    slug,
    displayName,
    locationCode,
    fiscalYear: 2026,
    metrics,
    budgetLines,
  };
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  const filterTab = process.argv.find((a, i) => process.argv[i - 1] === '--tab');

  console.log('Reading Excel file...');
  const wb = XLSX.readFile(EXCEL_PATH);

  const tabs = filterTab
    ? LOCATION_TABS.filter(t => t === filterTab)
    : LOCATION_TABS;

  if (tabs.length === 0) {
    console.error('No matching tabs found. Available:', LOCATION_TABS.join(', '));
    process.exit(1);
  }

  const outputDir = path.join('scripts', 'budget-output');
  fs.mkdirSync(outputDir, { recursive: true });

  const allEntities: EntityBudget[] = [];

  for (const tabName of tabs) {
    console.log(`Parsing: ${tabName}`);
    const sheet = wb.Sheets[tabName];
    if (!sheet) {
      console.warn(`  Sheet not found: ${tabName}`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    const entity = parseLocationTab(rows, tabName);

    // Per-entity file
    const outPath = path.join(outputDir, `${entity.slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(entity, null, 2));
    console.log(`  → ${outPath}`);
    console.log(`     Metrics: ${entity.metrics.length}, P&L lines: ${entity.budgetLines.length}`);
    console.log(`     Accounts: ${entity.budgetLines.filter(l => l.rowType === 'account').length}`);
    console.log(`     Subtotals: ${entity.budgetLines.filter(l => l.rowType === 'subtotal').length}`);

    allEntities.push(entity);
  }

  // Summary file with all entities
  const summaryPath = path.join(outputDir, '_all-entities.json');
  fs.writeFileSync(summaryPath, JSON.stringify(allEntities, null, 2));
  console.log(`\nAll entities written to: ${summaryPath}`);

  // Print a quick sanity check for the first location
  const first = allEntities[0];
  if (first) {
    console.log(`\n── Sanity check: ${first.displayName} ──`);
    console.log('Metrics:');
    for (const m of first.metrics) {
      if (m.constant !== null) {
        console.log(`  ${m.key}: ${m.constant} (constant)`);
      } else {
        const vals = Object.values(m.monthly ?? {});
        const sum = vals.reduce((a, b) => a + b, 0);
        console.log(`  ${m.key}: annual total = ${m.annualTotal?.toLocaleString() ?? '—'}, sum of months = ${sum.toLocaleString()}`);
      }
    }
    console.log('\nSample P&L lines:');
    const samples = first.budgetLines.filter(l => l.rowType === 'account').slice(0, 5);
    for (const l of samples) {
      console.log(`  [${l.accountCode}] ${l.accountName}: Jan=${l.monthly['2026-01']?.toLocaleString()}, Annual=${l.annualTotal?.toLocaleString()}`);
    }
    const totalIncome = first.budgetLines.find(l => l.accountName === 'Total Income');
    if (totalIncome) {
      console.log(`\n  Total Income annual budget: $${totalIncome.annualTotal?.toLocaleString()}`);
      console.log(`  Total Income 2025 actuals:  $${totalIncome.actuals2025?.toLocaleString()}`);
    }
    const netIncome = first.budgetLines.find(l => l.accountName === 'Total Net Income');
    if (netIncome) {
      console.log(`  Net Income annual budget:   $${netIncome.annualTotal?.toLocaleString()}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
