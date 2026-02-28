/**
 * Debug: dump all CData Section rows for a class and compare with budget account codes.
 * Usage: npx tsx scripts/debug-actuals3.ts
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Inject table names from amplify_outputs.json (same logic as next.config.ts)
import { readFileSync } from 'fs';
const ampOut = JSON.parse(readFileSync('./amplify_outputs.json', 'utf-8'));
const c = ampOut.custom ?? {};
process.env.ENTITIES_TABLE = process.env.ENTITIES_TABLE || c.entitiesTableName;
process.env.BUDGET_DATA_TABLE = process.env.BUDGET_DATA_TABLE || c.budgetDataTableName;
process.env.DATA_SOURCES_TABLE = process.env.DATA_SOURCES_TABLE || c.dataSourcesTableName;
process.env.FINANCIAL_DATA_TABLE = process.env.FINANCIAL_DATA_TABLE || c.financialDataTableName;
process.env.WIDGET_TYPE_META_TABLE = process.env.WIDGET_TYPE_META_TABLE || c.widgetTypeMetaTableName;

import { queryCData } from '../src/lib/cdata.js';
import { getDataSource } from '../src/lib/data-sources.js';
import { getEntities } from '../src/lib/entities.js';
import { getWarehouseClassIndex } from '../src/lib/warehouse.js';
import { getAllBudgetClassData } from '../src/lib/budget-data.js';

let PREVIEW_ENTITY_ID = '';
const MONTH = '2026-01';

async function main() {
  // Get preview entity from widget-type-meta config
  const { docClient } = await import('../src/lib/dynamo.js');
  const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
  const metaTable = process.env.WIDGET_TYPE_META_TABLE;
  if (metaTable) {
    const cfg = await docClient.send(new GetCommand({ TableName: metaTable, Key: { id: '__preview-config__' } }));
    PREVIEW_ENTITY_ID = cfg.Item?.previewEntityId ?? '';
  }
  console.log('Preview entity:', PREVIEW_ENTITY_ID);

  console.log('ENTITIES_TABLE:', process.env.ENTITIES_TABLE?.slice(-30));
  // Resolve entity + credentials
  const entities = await getEntities();
  console.log('Entities found:', entities.length);
  if (entities.length > 0) console.log('First entity:', entities[0].id, entities[0].displayName);
  const entity = entities.find(e => e.id === PREVIEW_ENTITY_ID);
  if (!entity) { console.error('Entity not found, preview ID:', PREVIEW_ENTITY_ID); return; }

  let cdataUser = process.env.CDATA_USER ?? '';
  let cdataPat = process.env.CDATA_PAT ?? '';
  let catalog = entity.sourceConfig?.catalogId ?? entity.catalogId ?? process.env.CDATA_CATALOG ?? '';

  if (entity.dataSourceId) {
    const ds = await getDataSource(entity.dataSourceId);
    if (ds?.status === 'active') {
      cdataUser = ds.config.user ?? cdataUser;
      cdataPat = ds.config.pat ?? cdataPat;
      catalog = entity.sourceConfig?.catalogId ?? catalog;
    }
  }

  console.log('Catalog:', catalog);

  // Get class index + budget data
  const classIndex = await getWarehouseClassIndex(PREVIEW_ENTITY_ID);
  const budgetClasses = await getAllBudgetClassData(PREVIEW_ENTITY_ID, 2026);

  if (!classIndex?.length) { console.error('No class index'); return; }
  if (!budgetClasses.length) { console.error('No budget data'); return; }

  const classTableMap = new Map(classIndex.map(c => [c.id, c.tableName]));

  // Pick the first class (Huntington Beach)
  const bc = budgetClasses.find(b => b.className?.includes('Huntington')) ?? budgetClasses[0];
  const tableName = classTableMap.get(bc.classId);
  console.log(`\nClass: ${bc.className} (${bc.classId})`);
  console.log(`Table: ${tableName}`);

  if (!tableName) { console.error('No table for class'); return; }

  // Fetch ALL rows from CData (no filter on RowType)
  const col = `Jan_2026`;
  const sql = `SELECT account, RowGroup, RowType, ${col} FROM ${catalog}.QuickBooksOnline.${tableName}`;
  console.log(`\nSQL: ${sql}\n`);
  const rows = await queryCData(cdataUser, cdataPat, sql);

  console.log(`Total CData rows: ${rows.length}\n`);

  // Group by RowGroup
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const g = (r.RowGroup ?? '') as string;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(r);
  }

  for (const [group, gRows] of groups) {
    console.log(`\n=== ${group || '(empty)'} (${gRows.length} rows) ===`);
    for (const r of gRows) {
      const raw = ((r.account ?? '') as string);
      const trimmed = raw.trim();
      const codeMatch = /^(\d{4}-\d{2})\s+(.+)$/.exec(trimmed);
      const amt = r[col];
      console.log(`  RowType=${r.RowType} | code=${codeMatch?.[1] ?? 'N/A'} | amt=${amt} | raw="${raw}"`);
    }
  }

  // Now show budget account codes for this class
  console.log('\n\n=== Budget account codes for this class ===');
  const budgetLines = bc.budgetLines;
  const expenseLines = budgetLines.filter(l => l.rowType === 'account' && l.accountCode);
  for (const l of expenseLines) {
    console.log(`  code=${l.accountCode} | name="${l.accountName}" | budget=${l.monthly[MONTH] ?? 0}`);
  }
}

main().catch(console.error);
