import { PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, queryAllItems } from './dynamo';
import { Dashboard } from './types';

const TABLE_NAME = process.env.DASHBOARDS_TABLE || '';

export async function getDashboards(packageId: string): Promise<Dashboard[]> {
  if (!TABLE_NAME) return [];
  const items = await queryAllItems<Dashboard>({
    TableName: TABLE_NAME,
    IndexName: 'byPackage',
    KeyConditionExpression: 'packageId = :pid',
    ExpressionAttributeValues: { ':pid': packageId },
  });
  return items.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getDashboardsByClient(clientId: string): Promise<Dashboard[]> {
  if (!TABLE_NAME) return [];
  const items = await queryAllItems<Dashboard>({
    TableName: TABLE_NAME,
    IndexName: 'byClient',
    KeyConditionExpression: 'clientId = :cid',
    ExpressionAttributeValues: { ':cid': clientId },
  });
  return items.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getDashboardBySlug(packageId: string, slug: string): Promise<Dashboard | undefined> {
  const dashboards = await getDashboards(packageId);
  return dashboards.find(d => d.slug === slug);
}

export async function resolveDashboard(
  clientId: string,
  packageSlug: string,
  dashboardSlug: string,
): Promise<Dashboard | undefined> {
  // Import here to avoid circular dependency
  const { getPackageBySlug } = await import('./packages');
  const pkg = await getPackageBySlug(clientId, packageSlug);
  if (!pkg) return undefined;
  return getDashboardBySlug(pkg.id, dashboardSlug);
}

export async function addDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt'>): Promise<Dashboard> {
  if (!TABLE_NAME) throw new Error('DASHBOARDS_TABLE not configured');
  const item: Dashboard = {
    ...dashboard,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

export async function updateDashboard(
  id: string,
  updates: Partial<Pick<Dashboard, 'displayName' | 'slug' | 'sortOrder' | 'dataSourceType'>>,
): Promise<void> {
  if (!TABLE_NAME) throw new Error('DASHBOARDS_TABLE not configured');
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

export async function deleteDashboard(id: string): Promise<void> {
  if (!TABLE_NAME) throw new Error('DASHBOARDS_TABLE not configured');
  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id } }));
}
