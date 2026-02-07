import { PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, scanAllItems } from './dynamo';
import { ClientConfig } from './types';

const TABLE_NAME = process.env.CLIENTS_TABLE || '';

export async function getClients(): Promise<ClientConfig[]> {
  if (!TABLE_NAME) return [];
  return scanAllItems<ClientConfig>({ TableName: TABLE_NAME });
}

export async function addClient(client: {
  catalogId: string;
  displayName: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}): Promise<void> {
  if (!TABLE_NAME) throw new Error('CLIENTS_TABLE not configured');

  const item: Record<string, string> = {
    id: crypto.randomUUID(),
    catalogId: client.catalogId,
    displayName: client.displayName,
    createdAt: new Date().toISOString(),
  };
  if (client.email) item.email = client.email;
  if (client.firstName) item.firstName = client.firstName;
  if (client.lastName) item.lastName = client.lastName;

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));
}

export async function updateClient(
  id: string,
  updates: Partial<Omit<ClientConfig, 'id' | 'createdAt'>>,
): Promise<void> {
  if (!TABLE_NAME) throw new Error('CLIENTS_TABLE not configured');

  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const updateExpression = 'SET ' + entries.map(([, ], i) => `#f${i} = :v${i}`).join(', ');
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, string> = {};
  entries.forEach(([key, val], i) => {
    expressionAttributeNames[`#f${i}`] = key;
    expressionAttributeValues[`:v${i}`] = val as string;
  });

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  }));
}

export async function deleteClient(id: string): Promise<void> {
  if (!TABLE_NAME) throw new Error('CLIENTS_TABLE not configured');

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { id },
  }));
}
