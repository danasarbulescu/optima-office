import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './dynamo';
import { ClientMembership, ClientRole } from './types';

const TABLE_NAME = process.env.CLIENT_MEMBERSHIPS_TABLE || '';

export async function getMembershipForUser(userId: string): Promise<ClientMembership | null> {
  if (!TABLE_NAME) return null;

  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { userId },
  }));

  return (result.Item as ClientMembership) || null;
}

export async function setMembership(
  userId: string,
  clientId: string,
  role: ClientRole,
): Promise<void> {
  if (!TABLE_NAME) throw new Error('CLIENT_MEMBERSHIPS_TABLE not configured');

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { userId, clientId, role },
  }));
}
