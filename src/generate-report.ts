import * as fs from 'fs';
import * as path from 'path';
import { fetchPLSummaries, buildGroupValues, GroupValues } from './cdata';

const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): { month: string; verbose: boolean } {
  const args = process.argv.slice(2);
  let month = '';
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--month' && args[i + 1]) {
      month = args[i + 1];
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    }
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    console.error('Usage: ts-node src/generate-report.ts --month YYYY-MM [--verbose]');
    process.exit(1);
  }

  return { month, verbose };
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface PnLMonthEntry {
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netOperatingIncome: number;
  otherExpenses: number;
  netOtherIncome: number;
  netIncome: number;
}

interface PnLByMonth {
  months: PnLMonthEntry[];
  totals: Omit<PnLMonthEntry, 'label'>;
}

interface KPIs {
  revenueCurrentMo: number;
  revenue3MoAvg: number;
  ytdRevenue: number;
  pyToDateRevenue: number | null;
  yoyRevenueVariance: number | null;
  yoyRevenueVariancePct: number | null;
  grossMarginCurrentMo: number;
  grossMarginYTD: number;
  currentMoNetIncome: number;
  netIncomeYTD: number;
  pyToDateNetIncome: number | null;
  netIncomeYoyVariance: number | null;
}

// ---------------------------------------------------------------------------
// KPI computation
// ---------------------------------------------------------------------------

function sumRange(values: number[], from: number, to: number): number {
  let total = 0;
  for (let i = from; i <= to && i < values.length; i++) {
    total += values[i];
  }
  return total;
}

function computeKPIs(
  curGroups: GroupValues,
  pyGroups: GroupValues | null,
  monthIdx: number,
): KPIs {
  const income = curGroups.get('Income') || [];
  const grossProfit = curGroups.get('GrossProfit') || [];
  const netIncome = curGroups.get('NetIncome') || [];

  // Current month values
  const revenueCurrentMo = monthIdx >= 0 ? (income[monthIdx] || 0) : 0;
  const gpCurrentMo = monthIdx >= 0 ? (grossProfit[monthIdx] || 0) : 0;
  const currentMoNetIncome = monthIdx >= 0 ? (netIncome[monthIdx] || 0) : 0;

  // Revenue 3 prior months average
  let rev3Sum = 0;
  let rev3Count = 0;
  for (let i = monthIdx - 3; i < monthIdx; i++) {
    if (i >= 0 && i < income.length) {
      rev3Sum += income[i];
      rev3Count++;
    }
  }
  const revenue3MoAvg = rev3Count > 0 ? rev3Sum / rev3Count : 0;

  // YTD sums (Jan through selected month)
  const ytdRevenue = sumRange(income, 0, monthIdx);
  const ytdGP = sumRange(grossProfit, 0, monthIdx);
  const netIncomeYTD = sumRange(netIncome, 0, monthIdx);

  // Gross margins
  const grossMarginCurrentMo = revenueCurrentMo !== 0 ? (gpCurrentMo / revenueCurrentMo) * 100 : 0;
  const grossMarginYTD = ytdRevenue !== 0 ? (ytdGP / ytdRevenue) * 100 : 0;

  // Prior year
  let pyToDateRevenue: number | null = null;
  let yoyRevenueVariance: number | null = null;
  let yoyRevenueVariancePct: number | null = null;
  let pyToDateNetIncome: number | null = null;
  let netIncomeYoyVariance: number | null = null;

  if (pyGroups) {
    const pyIncome = pyGroups.get('Income') || [];
    const pyNetIncome = pyGroups.get('NetIncome') || [];

    pyToDateRevenue = sumRange(pyIncome, 0, monthIdx);
    pyToDateNetIncome = sumRange(pyNetIncome, 0, monthIdx);

    yoyRevenueVariance = ytdRevenue - pyToDateRevenue;
    yoyRevenueVariancePct = pyToDateRevenue !== 0
      ? (yoyRevenueVariance / pyToDateRevenue) * 100
      : null;
    netIncomeYoyVariance = netIncomeYTD - pyToDateNetIncome;
  }

  return {
    revenueCurrentMo,
    revenue3MoAvg,
    ytdRevenue,
    pyToDateRevenue,
    yoyRevenueVariance,
    yoyRevenueVariancePct,
    grossMarginCurrentMo,
    grossMarginYTD,
    currentMoNetIncome,
    netIncomeYTD,
    pyToDateNetIncome,
    netIncomeYoyVariance,
  };
}

// ---------------------------------------------------------------------------
// 13-month P&L
// ---------------------------------------------------------------------------

function build13MonthPnL(
  curGroups: GroupValues,
  pyGroups: GroupValues | null,
  selectedMonth: string,
): PnLByMonth {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [yearStr, moStr] = selectedMonth.split('-');
  const year = Number(yearStr);
  const moIdx = parseInt(moStr, 10) - 1;

  const groupKeys = [
    'Income', 'COGS', 'GrossProfit', 'Expenses',
    'NetOperatingIncome', 'OtherExpenses', 'NetOtherIncome', 'NetIncome',
  ] as const;

  const propNames: (keyof Omit<PnLMonthEntry, 'label'>)[] = [
    'revenue', 'cogs', 'grossProfit', 'expenses',
    'netOperatingIncome', 'otherExpenses', 'netOtherIncome', 'netIncome',
  ];

  function getValue(groupKey: string, monthNum: number, sourceYear: number): number {
    const groups = sourceYear === year ? curGroups : pyGroups;
    if (!groups) return 0;
    const arr = groups.get(groupKey);
    if (!arr) return 0;
    return arr[monthNum] || 0;
  }

  const months: PnLMonthEntry[] = [];

  // Phase 1: Prior year months from moIdx through Dec
  for (let m = moIdx; m <= 11; m++) {
    const label = `${monthNames[m]} ${String(year - 1).slice(2)}`;
    const entry: any = { label };
    for (let g = 0; g < groupKeys.length; g++) {
      entry[propNames[g]] = getValue(groupKeys[g], m, year - 1);
    }
    months.push(entry as PnLMonthEntry);
  }

  // Phase 2: Current year months from Jan through moIdx (inclusive)
  for (let m = 0; m <= moIdx; m++) {
    const label = `${monthNames[m]} ${String(year).slice(2)}`;
    const entry: any = { label };
    for (let g = 0; g < groupKeys.length; g++) {
      entry[propNames[g]] = getValue(groupKeys[g], m, year);
    }
    months.push(entry as PnLMonthEntry);
  }

  const totals: any = {};
  for (const prop of propNames) {
    totals[prop] = months.reduce((sum, mo) => sum + (mo as any)[prop], 0);
  }

  return { months, totals };
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

function formatAbbrev(value: number): string {
  const abs = Math.abs(value);
  let formatted: string;

  if (abs >= 1_000_000) {
    formatted = (abs / 1_000_000).toFixed(1) + 'M';
  } else if (abs >= 1_000) {
    formatted = (abs / 1_000).toFixed(2) + 'K';
  } else {
    formatted = abs.toFixed(2);
  }

  if (value < 0) return `(${formatted})`;
  return formatted;
}

function formatPct(value: number): string {
  return value.toFixed(2) + '%';
}

function formatVariance(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return prefix + formatAbbrev(value);
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function generatePnLTableHTML(pnl: PnLByMonth): string {
  const rows: [string, keyof Omit<PnLMonthEntry, 'label'>, boolean][] = [
    ['Revenue',              'revenue',            false],
    ['Cost of Goods Sold',   'cogs',               false],
    ['Gross Profit',         'grossProfit',         true],
    ['Operating Expenses',   'expenses',            false],
    ['Net Operating Income', 'netOperatingIncome',  true],
    ['Other Expenses',       'otherExpenses',       false],
    ['Net Other Income',     'netOtherIncome',      false],
    ['Net Income',           'netIncome',           true],
  ];

  const headerCells = pnl.months
    .map(m => `<th>${m.label}</th>`)
    .join('\n          ');

  const bodyRows = rows.map(([label, key, isSummary]) => {
    const cls = isSummary ? ' class="summary-row"' : '';
    const cells = pnl.months
      .map(m => `<td>${formatAbbrev(m[key])}</td>`)
      .join('');
    const totalCell = `<td>${formatAbbrev(pnl.totals[key])}</td>`;
    return `      <tr${cls}>
        <td class="row-label">${label}</td>
        ${cells}
        ${totalCell}
      </tr>`;
  }).join('\n');

  return `
<!-- P&L by Month -->
<div class="pnl-section">
  <h2>P&amp;L by Month</h2>
  <div class="table-scroll">
    <table class="pnl-table">
      <thead>
        <tr>
          <th class="row-label"></th>
          ${headerCells}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
${bodyRows}
      </tbody>
    </table>
  </div>
</div>`;
}

function generateHTML(kpis: KPIs, selectedMonth: string, pnlByMonth?: PnLByMonth): string {
  const na = 'N/A';

  // Variance HTML helpers
  const varianceColor = (val: number | null) =>
    val === null ? '#999' : val >= 0 ? '#2ecc71' : '#e74c3c';

  const yoyRevHTML = kpis.yoyRevenueVariance !== null
    ? `<div class="variance" style="color:${varianceColor(kpis.yoyRevenueVariance)}">
        ${formatVariance(kpis.yoyRevenueVariance)}
        ${kpis.yoyRevenueVariancePct !== null ? `&nbsp;&nbsp;${kpis.yoyRevenueVariancePct >= 0 ? '+' : ''}${kpis.yoyRevenueVariancePct.toFixed(2)}%` : ''}
       </div>
       <div class="sub-label">YOY Variance</div>`
    : '';

  const niYoyHTML = kpis.netIncomeYoyVariance !== null
    ? `<div class="variance" style="color:${varianceColor(kpis.netIncomeYoyVariance)}">${formatVariance(kpis.netIncomeYoyVariance)}</div>`
    : '';

  // P&L by month table
  const pnlTableHTML = pnlByMonth ? generatePnLTableHTML(pnlByMonth) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Financial Snapshot — ${selectedMonth}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f7fa;
    color: #1a1a2e;
    padding: 40px 24px;
  }
  h1 {
    text-align: center;
    color: #1a3cad;
    font-size: 28px;
    letter-spacing: 2px;
    margin-bottom: 32px;
    text-transform: uppercase;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    max-width: 1200px;
    margin: 0 auto 24px;
  }
  .grid-5 {
    grid-template-columns: repeat(5, 1fr);
  }
  .card {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    overflow: hidden;
    text-align: center;
    min-height: 140px;
    display: flex;
    flex-direction: column;
  }
  .card-header {
    background: #1a3cad;
    color: #fff;
    padding: 12px 8px;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.3;
    text-transform: capitalize;
  }
  .card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 16px 8px 12px;
  }
  .kpi-value {
    font-size: 28px;
    font-weight: 700;
    color: #1a1a2e;
  }
  .variance {
    font-size: 13px;
    font-weight: 600;
    margin-top: 4px;
  }
  .sub-label {
    font-size: 11px;
    color: #666;
    margin-top: 2px;
  }
  @media (max-width: 900px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
    .grid-5 { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 600px) {
    .grid, .grid-5 { grid-template-columns: 1fr 1fr; }
  }
  /* P&L by Month table */
  .pnl-section {
    max-width: 1200px;
    margin: 40px auto 0;
  }
  .pnl-section h2 {
    color: #1a3cad;
    font-size: 20px;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 16px;
    text-align: center;
  }
  .table-scroll {
    overflow-x: auto;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .pnl-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    white-space: nowrap;
    min-width: 900px;
  }
  .pnl-table thead th {
    background: #1a3cad;
    color: #fff;
    padding: 10px 12px;
    font-weight: 700;
    text-align: right;
    position: sticky;
    top: 0;
  }
  .pnl-table thead th.row-label {
    text-align: left;
    min-width: 160px;
    position: sticky;
    left: 0;
    z-index: 2;
    background: #1a3cad;
  }
  .pnl-table tbody td {
    padding: 8px 12px;
    text-align: right;
    border-bottom: 1px solid #eee;
  }
  .pnl-table tbody td.row-label {
    text-align: left;
    font-weight: 600;
    color: #1a1a2e;
    position: sticky;
    left: 0;
    background: #fff;
    z-index: 1;
  }
  .pnl-table tbody tr.summary-row td {
    font-weight: 700;
    border-top: 2px solid #1a3cad;
    border-bottom: 2px solid #1a3cad;
  }
  .pnl-table tbody tr.summary-row td.row-label {
    color: #1a3cad;
  }
  .pnl-table tbody tr:hover td {
    background: #f0f4ff;
  }
  .pnl-table tbody tr:hover td.row-label {
    background: #f0f4ff;
  }
  .pnl-table tbody tr.summary-row:hover td {
    background: #e8edf8;
  }
  .pnl-table tbody tr.summary-row:hover td.row-label {
    background: #e8edf8;
  }
</style>
</head>
<body>

<h1>Financial Snapshot</h1>

<!-- Row 1: Revenue metrics -->
<div class="grid">
  <div class="card">
    <div class="card-header">Revenue<br>Current Mo.</div>
    <div class="card-body">
      <div class="kpi-value">${formatAbbrev(kpis.revenueCurrentMo)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Revenue 3<br>prior mos. avg.</div>
    <div class="card-body">
      <div class="kpi-value">${formatAbbrev(kpis.revenue3MoAvg)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">YTD<br>Revenue</div>
    <div class="card-body">
      <div class="kpi-value">${formatAbbrev(kpis.ytdRevenue)}</div>
      ${yoyRevHTML}
    </div>
  </div>

  <div class="card">
    <div class="card-header">PY to Date<br>Revenue</div>
    <div class="card-body">
      <div class="kpi-value">${kpis.pyToDateRevenue !== null ? formatAbbrev(kpis.pyToDateRevenue) : na}</div>
    </div>
  </div>
</div>

<!-- Row 2: Margin & net income -->
<div class="grid grid-5">
  <div class="card">
    <div class="card-header">Gross margin<br>Current Mo.</div>
    <div class="card-body">
      <div class="kpi-value">${formatPct(kpis.grossMarginCurrentMo)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Gross<br>margin YTD</div>
    <div class="card-body">
      <div class="kpi-value">${formatPct(kpis.grossMarginYTD)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Current Mo.<br>Net Income</div>
    <div class="card-body">
      <div class="kpi-value">${formatAbbrev(kpis.currentMoNetIncome)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Net Income<br>YTD</div>
    <div class="card-body">
      <div class="kpi-value">${formatAbbrev(kpis.netIncomeYTD)}</div>
      ${niYoyHTML}
    </div>
  </div>

  <div class="card">
    <div class="card-header">PY to Date<br>Net Income</div>
    <div class="card-body">
      <div class="kpi-value">${kpis.pyToDateNetIncome !== null ? formatAbbrev(kpis.pyToDateNetIncome) : na}</div>
    </div>
  </div>
</div>

${pnlTableHTML}

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Verbose output
// ---------------------------------------------------------------------------

function printVerbose(
  curGroups: GroupValues,
  pyGroups: GroupValues | null,
  monthIdx: number,
  selectedMonth: string,
  kpis: KPIs,
): void {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [yearStr] = selectedMonth.split('-');
  const year = Number(yearStr);

  console.log('\n' + '='.repeat(80));
  console.log(`  VERBOSE AUDIT — Selected month: ${selectedMonth} (month index: ${monthIdx})`);
  console.log('='.repeat(80));

  console.log(`\n--- Current year P&L group summaries (${year}) ---`);
  for (const [group, values] of curGroups) {
    console.log(`\n  ${group}:`);
    const parts: string[] = [];
    for (let i = 0; i < 12; i++) {
      parts.push(`${monthNames[i]}=${values[i].toFixed(2)}`);
    }
    parts.push(`Total=${(values[12] ?? 0).toFixed(2)}`);
    console.log(`    ${parts.join('  |  ')}`);
  }

  if (pyGroups) {
    console.log(`\n--- Prior year P&L group summaries (${year - 1}) ---`);
    for (const [group, values] of pyGroups) {
      console.log(`\n  ${group}:`);
      const parts: string[] = [];
      for (let i = 0; i < 12; i++) {
        parts.push(`${monthNames[i]}=${values[i].toFixed(2)}`);
      }
      parts.push(`Total=${(values[12] ?? 0).toFixed(2)}`);
      console.log(`    ${parts.join('  |  ')}`);
    }
  } else {
    console.log('\n--- No prior year P&L data available ---');
  }

  const income = curGroups.get('Income') || [];
  const grossProfit = curGroups.get('GrossProfit') || [];
  const netIncome = curGroups.get('NetIncome') || [];

  console.log('\n--- KPI calculation breakdown ---\n');

  console.log(`  Revenue Current Mo.     = Income[${monthIdx}] = ${kpis.revenueCurrentMo.toFixed(2)}`);

  const prior3Indices: string[] = [];
  for (let i = monthIdx - 3; i < monthIdx; i++) {
    if (i >= 0 && i < income.length) {
      prior3Indices.push(`Income[${i}]=${income[i].toFixed(2)}`);
    }
  }
  console.log(`  Revenue 3 prior mos avg = avg(${prior3Indices.join(', ')}) = ${kpis.revenue3MoAvg.toFixed(2)}`);

  const ytdParts: string[] = [];
  for (let i = 0; i <= monthIdx && i < income.length; i++) {
    ytdParts.push(income[i].toFixed(2));
  }
  console.log(`  YTD Revenue             = sum(Income[0..${monthIdx}]) = sum(${ytdParts.join(' + ')}) = ${kpis.ytdRevenue.toFixed(2)}`);

  if (kpis.pyToDateRevenue !== null) {
    console.log(`  PY to Date Revenue      = ${kpis.pyToDateRevenue.toFixed(2)}`);
    console.log(`  YOY Revenue Variance    = ${kpis.ytdRevenue.toFixed(2)} - ${kpis.pyToDateRevenue.toFixed(2)} = ${kpis.yoyRevenueVariance!.toFixed(2)}`);
    if (kpis.yoyRevenueVariancePct !== null) {
      console.log(`  YOY Revenue Variance %  = ${kpis.yoyRevenueVariancePct.toFixed(2)}%`);
    }
  }

  const gpCurMo = monthIdx >= 0 ? (grossProfit[monthIdx] || 0) : 0;
  console.log(`  Gross Margin Current Mo = GP[${monthIdx}] / Income[${monthIdx}] = ${gpCurMo.toFixed(2)} / ${kpis.revenueCurrentMo.toFixed(2)} = ${kpis.grossMarginCurrentMo.toFixed(2)}%`);

  const ytdGP = sumRange(grossProfit, 0, monthIdx);
  console.log(`  Gross Margin YTD        = sum(GP[0..${monthIdx}]) / sum(Income[0..${monthIdx}]) = ${ytdGP.toFixed(2)} / ${kpis.ytdRevenue.toFixed(2)} = ${kpis.grossMarginYTD.toFixed(2)}%`);

  console.log(`  Current Mo. Net Income  = NetIncome[${monthIdx}] = ${kpis.currentMoNetIncome.toFixed(2)}`);

  const ytdNIParts: string[] = [];
  for (let i = 0; i <= monthIdx && i < netIncome.length; i++) {
    ytdNIParts.push(netIncome[i].toFixed(2));
  }
  console.log(`  Net Income YTD          = sum(NI[0..${monthIdx}]) = sum(${ytdNIParts.join(' + ')}) = ${kpis.netIncomeYTD.toFixed(2)}`);

  if (kpis.pyToDateNetIncome !== null) {
    console.log(`  PY to Date Net Income   = ${kpis.pyToDateNetIncome.toFixed(2)}`);
    console.log(`  Net Income YOY Variance = ${kpis.netIncomeYTD.toFixed(2)} - ${kpis.pyToDateNetIncome.toFixed(2)} = ${kpis.netIncomeYoyVariance!.toFixed(2)}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { month, verbose } = parseArgs();
  const [yearStr, moStr] = month.split('-');
  const year = Number(yearStr);
  const monthIdx = parseInt(moStr, 10) - 1;

  // Fetch PL data from CData
  console.log('Fetching P&L data from CData...');
  const plRows = await fetchPLSummaries();

  if (plRows.length === 0) {
    console.error('No PL summary data returned from CData.');
    process.exit(1);
  }

  console.log(`Received ${plRows.length} summary rows.`);

  // Build GroupValues for current and prior year
  const curGroups = buildGroupValues(plRows, year);
  const pyGroups = buildGroupValues(plRows, year - 1);

  // Check if prior year has meaningful data
  const pyHasData = [...pyGroups.values()].some(arr => arr.slice(0, 12).some(v => v !== 0));

  // Compute KPIs
  const kpis = computeKPIs(curGroups, pyHasData ? pyGroups : null, monthIdx);

  if (verbose) {
    printVerbose(curGroups, pyHasData ? pyGroups : null, monthIdx, month, kpis);
  }

  // Build 13-month P&L data
  const pnlByMonth = build13MonthPnL(curGroups, pyHasData ? pyGroups : null, month);

  // Generate HTML
  const html = generateHTML(kpis, month, pnlByMonth);

  // Write output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const outputPath = path.join(OUTPUT_DIR, 'dashboard.html');
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`Dashboard saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
