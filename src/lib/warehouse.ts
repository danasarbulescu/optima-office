import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, queryAllItems } from './dynamo';
import { FinancialRow } from './models/financial';
import { FinancialDataItem } from './types';

const TABLE_NAME = process.env.FINANCIAL_DATA_TABLE || '';
const BATCH_SIZE = 25;

/**
 * Read financial data for an entity from the warehouse.
 * Returns null if no data exists.
 */
export async function getWarehouseData(entityId: string): Promise<FinancialRow[] | null> {
  if (!TABLE_NAME) return null;

  const items = await queryAllItems<FinancialDataItem>({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'entityId = :eid',
    ExpressionAttributeValues: { ':eid': entityId },
  });

  if (items.length === 0) return null;

  // Filter out metadata item, keep only data items with category/period/value
  const dataItems = items.filter(
    (item): item is FinancialDataItem & { category: string; period: string; value: number } =>
      item.sk !== '#metadata' && !!item.category && !!item.period && item.value !== undefined,
  );

  if (dataItems.length === 0) return null;

  // Group by category and assemble periods map
  const rowMap = new Map<string, FinancialRow>();

  for (const item of dataItems) {
    let row = rowMap.get(item.category);
    if (!row) {
      row = { category: item.category, periods: {} };
      rowMap.set(item.category, row);
    }
    row.periods[item.period] = item.value;
  }

  return Array.from(rowMap.values());
}

/**
 * Write financial data for an entity to the warehouse.
 * Explodes FinancialRow[] into per-period items and batch writes.
 */
export async function setWarehouseData(
  entityId: string,
  entityName: string,
  rows: FinancialRow[],
  sourceType: string,
): Promise<void> {
  if (!TABLE_NAME) return;

  const now = new Date().toISOString();
  const items: FinancialDataItem[] = [];

  // Metadata item
  items.push({
    entityId,
    sk: '#metadata',
    sourceType,
    syncedAt: now,
    entityName,
    lastSyncedAt: now,
  });

  // Data items: one per category+period
  for (const row of rows) {
    for (const [period, value] of Object.entries(row.periods)) {
      items.push({
        entityId,
        sk: `${row.category}#${period}`,
        category: row.category,
        period,
        value,
        sourceType,
        syncedAt: now,
      });
    }
  }

  // Batch write in chunks of 25
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: chunk.map(item => ({ PutRequest: { Item: item } })),
      },
    }));
  }
}

/**
 * Delete all warehouse data for an entity (data items + metadata).
 */
export async function deleteWarehouseData(entityId: string): Promise<void> {
  if (!TABLE_NAME) return;

  const items = await queryAllItems<FinancialDataItem>({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'entityId = :eid',
    ExpressionAttributeValues: { ':eid': entityId },
    ProjectionExpression: 'entityId, sk',
  });

  if (items.length === 0) return;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: chunk.map(item => ({
          DeleteRequest: { Key: { entityId: item.entityId, sk: item.sk } },
        })),
      },
    }));
  }
}
