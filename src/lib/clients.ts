import { PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, scanAllItems } from './dynamo';
import { ClientConfig } from './types';

const TABLE_NAME = process.env.CLIENTS_TABLE || '';

export async function getClients(): Promise<ClientConfig[]> {
  if (!TABLE_NAME) return [];
  return scanAllItems<ClientConfig>({ TableName: TABLE_NAME });
}

export async function addClient(id: string, displayName: string): Promise<void> {
  if (!TABLE_NAME) throw new Error('CLIENTS_TABLE not configured');

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      id,
      displayName,
      createdAt: new Date().toISOString(),
    },
  }));
}

export async function deleteClient(id: string): Promise<void> {
  if (!TABLE_NAME) throw new Error('CLIENTS_TABLE not configured');

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { id },
  }));
}
