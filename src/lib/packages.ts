import { PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, queryAllItems } from './dynamo';
import { Package } from './types';

const TABLE_NAME = process.env.PACKAGES_TABLE || '';

export async function getPackages(clientId: string): Promise<Package[]> {
  if (!TABLE_NAME) return [];
  const items = await queryAllItems<Package>({
    TableName: TABLE_NAME,
    IndexName: 'byClient',
    KeyConditionExpression: 'clientId = :cid',
    ExpressionAttributeValues: { ':cid': clientId },
  });
  return items.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getPackageBySlug(clientId: string, slug: string): Promise<Package | undefined> {
  const packages = await getPackages(clientId);
  return packages.find(p => p.slug === slug);
}

export async function addPackage(pkg: Omit<Package, 'id' | 'createdAt'>): Promise<Package> {
  if (!TABLE_NAME) throw new Error('PACKAGES_TABLE not configured');
  const item: Package = {
    ...pkg,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

export async function updatePackage(
  id: string,
  updates: Partial<Pick<Package, 'displayName' | 'slug' | 'sortOrder'>>,
): Promise<void> {
  if (!TABLE_NAME) throw new Error('PACKAGES_TABLE not configured');
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

export async function deletePackage(id: string): Promise<void> {
  if (!TABLE_NAME) throw new Error('PACKAGES_TABLE not configured');
  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id } }));
}
