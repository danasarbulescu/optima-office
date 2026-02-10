import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { docClient, scanAllItems } from './dynamo';
import { DataSource } from './types';

const TABLE = process.env.DATA_SOURCES_TABLE || '';

export async function getDataSources(): Promise<DataSource[]> {
  if (!TABLE) return [];
  return scanAllItems<DataSource>({ TableName: TABLE });
}

export async function getDataSource(id: string): Promise<DataSource | null> {
  if (!TABLE) return null;
  const result = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { id },
  }));
  return (result.Item as DataSource) || null;
}

export async function addDataSource(data: {
  type: string;
  displayName: string;
  config: Record<string, string>;
}): Promise<string> {
  if (!TABLE) throw new Error('DATA_SOURCES_TABLE not configured');
  const id = randomUUID();
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: {
      id,
      type: data.type,
      displayName: data.displayName,
      config: data.config,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  }));
  return id;
}

export async function updateDataSource(id: string, updates: Record<string, unknown>): Promise<void> {
  if (!TABLE) throw new Error('DATA_SOURCES_TABLE not configured');

  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined) continue;
    const attrName = `#${key}`;
    const attrVal = `:${key}`;
    expressions.push(`${attrName} = ${attrVal}`);
    names[attrName] = key;
    values[attrVal] = val;
  }

  if (expressions.length === 0) return;

  await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { id },
    UpdateExpression: `SET ${expressions.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

export async function deleteDataSource(id: string): Promise<void> {
  if (!TABLE) throw new Error('DATA_SOURCES_TABLE not configured');
  await docClient.send(new DeleteCommand({
    TableName: TABLE,
    Key: { id },
  }));
}
