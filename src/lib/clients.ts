import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { docClient, scanAllItems } from './dynamo';
import { Client } from './types';

const TABLE = process.env.CLIENTS_TABLE || '';

export async function getClients(): Promise<Client[]> {
  return scanAllItems<Client>({ TableName: TABLE });
}

export async function getClient(id: string): Promise<Client | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { id },
  }));
  return (result.Item as Client) || null;
}

export async function addClient(data: {
  slug: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}): Promise<string> {
  const id = randomUUID();
  const item: Record<string, unknown> = {
    id,
    slug: data.slug,
    displayName: data.displayName,
    createdAt: new Date().toISOString(),
    status: 'active',
  };
  if (data.firstName) item.firstName = data.firstName;
  if (data.lastName) item.lastName = data.lastName;
  if (data.email) item.email = data.email;

  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return id;
}

export async function updateClient(id: string, updates: Record<string, unknown>): Promise<void> {
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

export async function deleteClient(id: string): Promise<void> {
  await docClient.send(new DeleteCommand({
    TableName: TABLE,
    Key: { id },
  }));
}
