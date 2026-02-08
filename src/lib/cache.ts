import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './dynamo';
import { FinancialRow } from './models/financial';
import { PLCacheEntry } from './types';

const TABLE_NAME = process.env.PL_CACHE_TABLE || '';
const CACHE_TTL_HOURS = 24;

/** Build a client-scoped cache key: "{clientId}#{entityId}" */
function cacheKey(clientId: string, entityId: string): string {
  return `${clientId}#${entityId}`;
}

export async function getCachedPL(clientId: string, entityId: string): Promise<PLCacheEntry | null> {
  if (!TABLE_NAME) return null;

  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { entityId: cacheKey(clientId, entityId) },
  }));

  if (!result.Item) return null;

  const entry = result.Item as PLCacheEntry;
  const age = Date.now() - new Date(entry.fetchedAt).getTime();
  if (age > CACHE_TTL_HOURS * 60 * 60 * 1000) {
    return null; // stale
  }

  return entry;
}

export async function setCachedPL(
  clientId: string,
  entityId: string,
  entityName: string,
  rows: FinancialRow[],
): Promise<void> {
  if (!TABLE_NAME) return;

  const now = new Date();
  const ttl = Math.floor(now.getTime() / 1000) + CACHE_TTL_HOURS * 2 * 60 * 60;

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      entityId: cacheKey(clientId, entityId),
      entityName,
      rows,
      fetchedAt: now.toISOString(),
      ttl,
    },
  }));
}
