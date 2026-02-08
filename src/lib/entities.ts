import { PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, scanAllItems, queryAllItems } from './dynamo';
import { EntityConfig } from './types';

const TABLE_NAME = process.env.ENTITIES_TABLE || '';

/**
 * Get entities. If clientId is provided, queries the byClient GSI.
 * If clientId is null/undefined (internal user viewing all), scans the full table.
 */
export async function getEntities(clientId?: string): Promise<EntityConfig[]> {
  if (!TABLE_NAME) return [];

  if (clientId) {
    return queryAllItems<EntityConfig>({
      TableName: TABLE_NAME,
      IndexName: 'byClient',
      KeyConditionExpression: 'clientId = :cid',
      ExpressionAttributeValues: { ':cid': clientId },
    });
  }

  return scanAllItems<EntityConfig>({ TableName: TABLE_NAME });
}

export async function addEntity(clientId: string, entity: {
  catalogId: string;
  displayName: string;
}): Promise<void> {
  if (!TABLE_NAME) throw new Error('ENTITIES_TABLE not configured');

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      id: crypto.randomUUID(),
      clientId,
      catalogId: entity.catalogId,
      displayName: entity.displayName,
      createdAt: new Date().toISOString(),
    },
  }));
}

export async function updateEntity(
  id: string,
  updates: Partial<Omit<EntityConfig, 'id' | 'clientId' | 'createdAt'>>,
): Promise<void> {
  if (!TABLE_NAME) throw new Error('ENTITIES_TABLE not configured');

  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const updateExpression = 'SET ' + entries.map(([,], i) => `#f${i} = :v${i}`).join(', ');
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

export async function deleteEntity(id: string): Promise<void> {
  if (!TABLE_NAME) throw new Error('ENTITIES_TABLE not configured');

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { id },
  }));
}
