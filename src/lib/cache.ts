import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CDataPLRow, PLCacheEntry } from './types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.PL_CACHE_TABLE || '';
const CACHE_TTL_HOURS = 24;

export async function getCachedPL(companyId: string): Promise<PLCacheEntry | null> {
  if (!TABLE_NAME) return null;

  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { companyId },
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
  companyId: string,
  clientName: string,
  plRows: CDataPLRow[],
): Promise<void> {
  if (!TABLE_NAME) return;

  const now = new Date();
  const ttl = Math.floor(now.getTime() / 1000) + CACHE_TTL_HOURS * 2 * 60 * 60;

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      companyId,
      clientName,
      plRows,
      fetchedAt: now.toISOString(),
      ttl,
    },
  }));
}
