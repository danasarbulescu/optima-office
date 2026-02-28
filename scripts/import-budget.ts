/**
 * Import Budget Data into DynamoDB
 *
 * Reads the parsed Excel budget JSON from scripts/budget-output/,
 * matches each location tab to a QuickBooks class (via the entity's warehouse class index),
 * and writes structured budget blobs to the BudgetData DynamoDB table.
 *
 * Prerequisites:
 *   1. Run parse-budget-excel.ts first to generate scripts/budget-output/*.json
 *   2. Sandbox must be running (or amplify_outputs.json must be present)
 *
 * Usage:
 *   npx tsx scripts/import-budget.ts
 *   npx tsx scripts/import-budget.ts --dry-run
 *   npx tsx scripts/import-budget.ts --list-classes
 *
 * Flags:
 *   --entity-id   Override entity UUID (default: The Russel Fischer Partnership)
 *   --dry-run     Show what would be written without actually writing to DynamoDB
 *   --list-classes  List available QB classes for this entity and exit
 *   --year        Fiscal year to import (default: 2026)
 */

import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env.local first, then fill gaps from amplify_outputs.json (same pattern as next.config.ts)
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const require = createRequire(import.meta.url);

// Fill any missing DynamoDB table env vars from amplify_outputs.json
try {
  const amplifyOutputs = require(path.join(process.cwd(), 'amplify_outputs.json'));
  const custom = amplifyOutputs?.custom ?? {};
  if (!process.env.FINANCIAL_DATA_TABLE) process.env.FINANCIAL_DATA_TABLE = custom.financialDataTableName ?? '';
  if (!process.env.BUDGET_DATA_TABLE)    process.env.BUDGET_DATA_TABLE    = custom.budgetDataTableName    ?? '';
} catch { /* amplify_outputs.json not present — rely on .env.local */ }

// Dynamic imports after env is loaded
const { getWarehouseClassIndex } = await import('../src/lib/warehouse.js');
const { setBudgetClassData, setBudgetMetadata, deleteBudgetYear } = await import('../src/lib/budget-data.js');
const { fetchClassNames } = await import('../src/lib/cdata.js');

// ─── Types from parse-budget-excel output ────────────────────────────────────

interface ParsedEntityBudget {
  tabName: string;
  slug: string;
  displayName: string;
  locationCode: string;
  fiscalYear: number;
  metrics: Array<{
    key: string;
    label: string;
    monthly: Record<string, number> | null;
    constant: number | null;
    annualTotal: number | null;
  }>;
  budgetLines: Array<{
    accountCode: string | null;
    accountName: string;
    rowType: 'account' | 'subtotal' | 'section';
    depth: number;
    monthly: Record<string, number>;
    annualTotal: number | null;
    actuals2025: number | null;
  }>;
}

// ─── Class name matching ──────────────────────────────────────────────────────

/**
 * Normalize a class/tab name for fuzzy matching.
 * "01 - Huntington Beach" → "huntington beach"
 * "Huntington Beach" → "huntington beach"
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^\d+\s*[-–—]\s*/, '') // strip leading "01 - " prefix
    .trim();
}

interface DiscoveredClass {
  id: string;
  name: string;
  tableName: string;
}

/**
 * Match an Excel tab name to a QuickBooks class from the warehouse index.
 * Tries exact match first, then normalized match, then partial match.
 */
function matchClass(
  tabName: string,
  classes: DiscoveredClass[],
): DiscoveredClass | null {
  // 1. Exact match
  const exact = classes.find(c => c.name === tabName);
  if (exact) return exact;

  // 2. Normalized match (strip leading "NN - " from both sides)
  const normalTab = normalizeName(tabName);
  const norm = classes.find(c => normalizeName(c.name) === normalTab);
  if (norm) return norm;

  // 3. Partial: normalized tab name is contained in class name or vice versa
  const partial = classes.find(c => {
    const nc = normalizeName(c.name);
    return nc.includes(normalTab) || normalTab.includes(nc);
  });
  return partial ?? null;
}

// ─── Arg parsing ─────────────────────────────────────────────────────────────

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Default to The Russel Fischer Partnership entity UUID
  const entityId = getArg('--entity-id') ?? '5ba66522-467c-4cc8-9d59-0162ab37b648';

  const isDryRun = hasFlag('--dry-run');
  const listClasses = hasFlag('--list-classes');
  const year = parseInt(getArg('--year') ?? '2026', 10);

  // ── Load warehouse class index for this entity ────────────────────────────
  console.log(`\nLooking up class index for entity: ${entityId}`);
  const warehouseClasses = await getWarehouseClassIndex(entityId);

  if (!warehouseClasses || warehouseClasses.length === 0) {
    console.warn('No class index found in warehouse for this entity.');
    console.warn('The entity may need a CData sync first to discover classes.');
    console.warn('Continuing with CData Class table lookup as fallback...\n');
  } else {
    console.log(`Found ${warehouseClasses.length} classes in warehouse index:`);
    for (const c of warehouseClasses) {
      console.log(`  [${c.id}] "${c.name}" (table: ${c.tableName})`);
    }
  }

  // ── If --list-classes, also show CData classes and exit ──────────────────
  if (listClasses) {
    const cdataUser = process.env.CDATA_USER;
    const cdataPat = process.env.CDATA_PAT;
    const cdataCatalog = process.env.CDATA_CATALOG;
    if (cdataUser && cdataPat && cdataCatalog) {
      console.log('\nFetching classes from CData QuickBooks.Class table...');
      const classMap = await fetchClassNames(cdataUser, cdataPat, cdataCatalog);
      console.log(`\nCData classes (${classMap.size}):`);
      for (const [id, name] of classMap) {
        console.log(`  [${id}] "${name}"`);
      }
    } else {
      console.warn('CData credentials not set — skipping CData class lookup.');
    }
    process.exit(0);
  }

  // ── Load parsed Excel budget JSON files ───────────────────────────────────
  const outputDir = path.join('scripts', 'budget-output');
  const jsonFiles = fs.readdirSync(outputDir).filter(
    f => f.endsWith('.json') && !f.startsWith('_'),
  );

  if (jsonFiles.length === 0) {
    console.error(`No budget JSON files found in ${outputDir}/`);
    console.error('Run: npx tsx scripts/parse-budget-excel.ts first.');
    process.exit(1);
  }

  const parsedEntities: ParsedEntityBudget[] = jsonFiles.map(f =>
    JSON.parse(fs.readFileSync(path.join(outputDir, f), 'utf-8'))
  );

  console.log(`\nLoaded ${parsedEntities.length} location budgets from ${outputDir}/`);

  // ── Match Excel tabs to QB classes ────────────────────────────────────────
  const availableClasses: DiscoveredClass[] = warehouseClasses ?? [];

  console.log('\n── Class matching ──────────────────────────────────────────');
  const importItems: Array<{
    parsed: ParsedEntityBudget;
    classId: string;
    className: string;
    matched: boolean;
  }> = [];

  for (const parsed of parsedEntities) {
    const matched = matchClass(parsed.tabName, availableClasses);
    if (matched) {
      console.log(`  ✓ "${parsed.tabName}" → classId: ${matched.id} ("${matched.name}")`);
      importItems.push({
        parsed,
        classId: matched.id,
        className: matched.name,
        matched: true,
      });
    } else {
      // No warehouse class match — use tab name as classId (import without class link)
      console.log(`  ! "${parsed.tabName}" → no QB class match; using tab slug as classId`);
      importItems.push({
        parsed,
        classId: parsed.slug,
        className: parsed.tabName,
        matched: false,
      });
    }
  }

  if (isDryRun) {
    console.log('\n[DRY RUN] Would write to DynamoDB:');
    for (const item of importItems) {
      console.log(`  BudgetData: entityId=${entityId} sk=budget#${year}#class#${item.classId}`);
      console.log(`    ${item.parsed.budgetLines.length} budget lines, ${item.parsed.metrics.length} metrics`);
    }
    console.log(`  BudgetData: entityId=${entityId} sk=budget#${year}#metadata`);
    console.log('\n[DRY RUN] No writes performed.');
    return;
  }

  // ── Delete existing budget data for this year before re-importing ─────────
  console.log(`\nClearing existing budget data for entity ${entityId}, year ${year}...`);
  await deleteBudgetYear(entityId, year);
  console.log('  Cleared.');

  // ── Write each class budget blob ──────────────────────────────────────────
  const now = new Date().toISOString();
  const metaClasses: Array<{
    classId: string; className: string; locationCode: string; importedAt: string;
  }> = [];

  console.log('\nWriting budget data to DynamoDB...');
  for (const item of importItems) {
    const data = {
      entityId,
      sk: `budget#${year}#class#${item.classId}`,
      fiscalYear: year,
      classId: item.classId,
      className: item.className,
      locationCode: item.parsed.locationCode,
      tabName: item.parsed.tabName,
      budgetLines: item.parsed.budgetLines,
      metrics: item.parsed.metrics,
      importedAt: now,
    };
    await setBudgetClassData(data);
    console.log(`  ✓ ${item.className} (${item.parsed.budgetLines.length} lines, ${item.parsed.metrics.length} metrics)`);
    metaClasses.push({
      classId: item.classId,
      className: item.className,
      locationCode: item.parsed.locationCode,
      importedAt: now,
    });
  }

  // ── Write metadata index ──────────────────────────────────────────────────
  await setBudgetMetadata({
    entityId,
    sk: `budget#${year}#metadata`,
    fiscalYear: year,
    classes: metaClasses,
    importedAt: now,
  });
  console.log(`  ✓ metadata index (${metaClasses.length} classes)`);

  console.log(`\nImport complete! ${importItems.length} classes written for FY${year}.`);
  console.log(`\nTo verify, query the API:`);
  console.log(`  GET /api/budget/${entityId}?year=${year}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
