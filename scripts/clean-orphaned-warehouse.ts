/**
 * Find and delete orphaned warehouse data — FinancialData rows
 * whose entityId no longer exists in the Entities table.
 *
 * Usage:
 *   npx tsx scripts/clean-orphaned-warehouse.ts          # preview only
 *   npx tsx scripts/clean-orphaned-warehouse.ts --execute # actually delete
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load env: .env.local first, then amplify_outputs.json fallback (mirrors next.config.ts)
try {
  const content = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local may not exist */ }

try {
  const outputs = JSON.parse(readFileSync(resolve(__dirname, '..', 'amplify_outputs.json'), 'utf-8'));
  const tableMap: Record<string, string | undefined> = {
    FINANCIAL_DATA_TABLE: outputs?.custom?.financialDataTableName,
    ENTITIES_TABLE: outputs?.custom?.entitiesTableName,
  };
  for (const [key, val] of Object.entries(tableMap)) {
    if (val && !process.env[key]) process.env[key] = val;
  }
} catch { /* amplify_outputs.json may not exist */ }

import { scanAllItems } from '../src/lib/dynamo';
import { getEntities } from '../src/lib/entities';
import { deleteWarehouseData } from '../src/lib/warehouse';

const TABLE_NAME = process.env.FINANCIAL_DATA_TABLE || '';

async function main() {
  const execute = process.argv.includes('--execute');

  if (!TABLE_NAME) {
    console.error('FINANCIAL_DATA_TABLE not set');
    process.exit(1);
  }

  // 1. Get all valid entity IDs
  const entities = await getEntities();
  const validIds = new Set(entities.map(e => e.id));
  console.log(`Found ${validIds.size} entities in Entities table`);

  // 2. Scan FinancialData for distinct entityIds (metadata items only to save reads)
  const metadataItems = await scanAllItems<{ entityId: string; sk: string }>({
    TableName: TABLE_NAME,
    FilterExpression: 'sk = :meta',
    ExpressionAttributeValues: { ':meta': '#metadata' },
    ProjectionExpression: 'entityId',
  });

  const warehouseEntityIds = new Set(metadataItems.map(i => i.entityId));
  console.log(`Found ${warehouseEntityIds.size} entities in FinancialData table`);

  // 3. Find orphans
  const orphanIds = [...warehouseEntityIds].filter(id => !validIds.has(id));

  if (orphanIds.length === 0) {
    console.log('\nNo orphaned data found.');
    return;
  }

  console.log(`\nFound ${orphanIds.length} orphaned entity ID(s):`);
  for (const id of orphanIds) {
    const meta = metadataItems.find(i => i.entityId === id) as any;
    console.log(`  - ${id}${meta?.entityName ? ` (${meta.entityName})` : ''}`);
  }

  if (!execute) {
    console.log('\nRun with --execute to delete orphaned data.');
    return;
  }

  // 4. Delete
  for (const id of orphanIds) {
    console.log(`Deleting warehouse data for ${id}...`);
    await deleteWarehouseData(id);
  }
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
