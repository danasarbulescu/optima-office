import { PutCommand, GetCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, queryAllItems } from './dynamo';
import { ClientUser } from './types';

const TABLE_NAME = process.env.CLIENT_USERS_TABLE || '';

export async function getClientUsers(clientId: string): Promise<ClientUser[]> {
  if (!TABLE_NAME) return [];

  return queryAllItems<ClientUser>({
    TableName: TABLE_NAME,
    IndexName: 'byClient',
    KeyConditionExpression: 'clientId = :cid',
    ExpressionAttributeValues: { ':cid': clientId },
  });
}

export async function getClientUser(id: string): Promise<ClientUser | null> {
  if (!TABLE_NAME) return null;

  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id },
  }));
  return (result.Item as ClientUser) || null;
}

export async function addClientUser(data: {
  clientId: string;
  email: string;
  firstName: string;
  lastName: string;
  authorizedPackageIds: string[];
  authorizedDashboardIds?: string[];
  cognitoUserId?: string;
}): Promise<ClientUser> {
  if (!TABLE_NAME) throw new Error('CLIENT_USERS_TABLE not configured');

  const item: ClientUser = {
    id: crypto.randomUUID(),
    clientId: data.clientId,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    status: 'active',
    authorizedPackageIds: data.authorizedPackageIds,
    authorizedDashboardIds: data.authorizedDashboardIds || [],
    cognitoUserId: data.cognitoUserId,
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

export async function updateClientUser(
  id: string,
  updates: Partial<Pick<ClientUser, 'firstName' | 'lastName' | 'email' | 'status' | 'authorizedPackageIds' | 'authorizedDashboardIds' | 'cognitoUserId'>>,
): Promise<void> {
  if (!TABLE_NAME) throw new Error('CLIENT_USERS_TABLE not configured');

  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const updateExpression = 'SET ' + entries.map(([,], i) => `#f${i} = :v${i}`).join(', ');
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};
  entries.forEach(([key, val], i) => {
    expressionAttributeNames[`#f${i}`] = key;
    expressionAttributeValues[`:v${i}`] = val;
  });

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  }));
}

export async function deleteClientUser(id: string): Promise<void> {
  if (!TABLE_NAME) throw new Error('CLIENT_USERS_TABLE not configured');

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { id },
  }));
}
