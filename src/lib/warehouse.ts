import { BatchGetCommand, BatchWriteCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, queryAllItems } from './dynamo';
import { FinancialRow } from './models/financial';
import { DiscoveredClass, FinancialDataItem } from './types';
import type { AccountActualRow } from './cdata';

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

  // Filter out metadata, class items, and class index — keep only consolidated data items
  const dataItems = items.filter(
    (item): item is FinancialDataItem & { category: string; period: string; value: number } =>
      item.sk !== '#metadata' && item.sk !== '#classes' && !item.sk.startsWith('class#') &&
      !!item.category && !!item.period && item.value !== undefined,
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

/**
 * Batch-read warehouse metadata (#metadata sort key) for multiple entities.
 * Returns a map of entityId → lastSyncedAt ISO string (or undefined if never synced).
 */
export async function getWarehouseMetadataBatch(
  entityIds: string[],
): Promise<Record<string, string | undefined>> {
  const result: Record<string, string | undefined> = {};
  if (!TABLE_NAME || entityIds.length === 0) return result;

  // BatchGetItem supports max 100 keys per request
  for (let i = 0; i < entityIds.length; i += 100) {
    const chunk = entityIds.slice(i, i + 100);
    const resp = await docClient.send(new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: chunk.map(eid => ({ entityId: eid, sk: '#metadata' })),
          ProjectionExpression: 'entityId, lastSyncedAt',
        },
      },
    }));

    const items = resp.Responses?.[TABLE_NAME] ?? [];
    for (const item of items) {
      result[item.entityId as string] = item.lastSyncedAt as string | undefined;
    }
  }

  return result;
}

// ── Class-level warehouse functions ──────────────────────────────────

/**
 * Write the class index item for an entity.
 * Stores the list of discovered classes under SK "#classes".
 */
export async function setWarehouseClassIndex(
  entityId: string,
  classes: DiscoveredClass[],
): Promise<void> {
  if (!TABLE_NAME) return;
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      entityId,
      sk: '#classes',
      classes,
      syncedAt: new Date().toISOString(),
    },
  }));
}

/**
 * Read the class index for an entity.
 * Returns the list of discovered classes, or null if none exist.
 */
export async function getWarehouseClassIndex(
  entityId: string,
): Promise<DiscoveredClass[] | null> {
  if (!TABLE_NAME) return null;
  const resp = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { entityId, sk: '#classes' },
  }));
  return (resp.Item?.classes as DiscoveredClass[]) || null;
}

/**
 * Write class-level financial data to the warehouse.
 * Uses SK format: "class#{classId}#{category}#{period}" for data items
 * and "class#{classId}#metadata" for class metadata.
 */
export async function setWarehouseClassData(
  entityId: string,
  classId: string,
  className: string,
  rows: FinancialRow[],
  sourceType: string,
): Promise<void> {
  if (!TABLE_NAME) return;

  const now = new Date().toISOString();
  const prefix = `class#${classId}`;
  const items: Record<string, unknown>[] = [];

  // Class metadata item
  items.push({
    entityId,
    sk: `${prefix}#metadata`,
    classId,
    className,
    sourceType,
    syncedAt: now,
  });

  // Data items: one per category+period
  for (const row of rows) {
    for (const [period, value] of Object.entries(row.periods)) {
      items.push({
        entityId,
        sk: `${prefix}#${row.category}#${period}`,
        classId,
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

// ── Account-level actuals cache ──────────────────────────────────

const ACTUALS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Read cached account-level actuals for a class + period.
 * Returns null on cache miss or stale data.
 * SK format: "classActuals#{classId}#{period}"
 */
export async function getCachedClassActuals(
  entityId: string,
  classId: string,
  period: string,
): Promise<AccountActualRow[] | null> {
  if (!TABLE_NAME) return null;
  const sk = `classActuals#${classId}#${period}`;
  const resp = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { entityId, sk },
  }));
  if (!resp.Item) return null;
  const cachedAt = resp.Item.cachedAt as string | undefined;
  if (cachedAt && Date.now() - new Date(cachedAt).getTime() > ACTUALS_CACHE_TTL_MS) {
    return null; // stale
  }
  return (resp.Item.accounts as AccountActualRow[]) ?? null;
}

/**
 * Write cached account-level actuals for a class + period.
 */
export async function setCachedClassActuals(
  entityId: string,
  classId: string,
  period: string,
  accounts: AccountActualRow[],
): Promise<void> {
  if (!TABLE_NAME) return;
  const sk = `classActuals#${classId}#${period}`;
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      entityId,
      sk,
      accounts,
      cachedAt: new Date().toISOString(),
    },
  }));
}

/**
 * Read class-level financial data from the warehouse.
 * Queries items with SK beginning with "class#{classId}#" and assembles FinancialRow[].
 */
export async function getWarehouseClassData(
  entityId: string,
  classId: string,
): Promise<FinancialRow[] | null> {
  if (!TABLE_NAME) return null;

  const prefix = `class#${classId}#`;
  const items = await queryAllItems<FinancialDataItem>({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'entityId = :eid AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':eid': entityId, ':prefix': prefix },
  });

  const dataItems = items.filter(
    (item): item is FinancialDataItem & { category: string; period: string; value: number } =>
      !item.sk.endsWith('#metadata') && !!item.category && !!item.period && item.value !== undefined,
  );

  if (dataItems.length === 0) return null;

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
