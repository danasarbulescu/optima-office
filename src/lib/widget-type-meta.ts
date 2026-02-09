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

export async function upsertWidgetTypeMeta(id: string, displayName: string): Promise<void> {
  if (!TABLE_NAME) throw new Error('WIDGET_TYPE_META_TABLE not configured');
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { id, displayName },
  }));
}

export async function deleteWidgetTypeMeta(id: string): Promise<void> {
  if (!TABLE_NAME) throw new Error('WIDGET_TYPE_META_TABLE not configured');
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { id },
  }));
}
