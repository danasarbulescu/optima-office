import { PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, scanAllItems } from './dynamo';
import { WidgetTypeMeta } from './types';

const TABLE_NAME = process.env.WIDGET_TYPE_META_TABLE || '';

export async function getAllWidgetTypeMeta(): Promise<WidgetTypeMeta[]> {
  if (!TABLE_NAME) return [];
  return scanAllItems<WidgetTypeMeta>({ TableName: TABLE_NAME });
}

export async function getWidgetTypeMeta(id: string): Promise<WidgetTypeMeta | null> {
  if (!TABLE_NAME) return null;
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id },
  }));
  return (result.Item as WidgetTypeMeta) || null;
}

export async function upsertWidgetTypeMeta(id: string, fields: { displayName?: string; description?: string }): Promise<void> {
  if (!TABLE_NAME) throw new Error('WIDGET_TYPE_META_TABLE not configured');
  // Merge with existing record so partial updates don't wipe other fields
  const existing = await getWidgetTypeMeta(id);
  const item: Record<string, unknown> = { id, ...existing, ...fields };
  // Remove undefined values
  for (const key of Object.keys(item)) {
    if (item[key] === undefined) delete item[key];
  }
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));
}

export async function deleteWidgetTypeMeta(id: string): Promise<void> {
  if (!TABLE_NAME) throw new Error('WIDGET_TYPE_META_TABLE not configured');
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { id },
  }));
}
