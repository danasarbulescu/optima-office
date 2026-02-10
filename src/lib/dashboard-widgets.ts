import { PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, queryAllItems, scanAllItems } from './dynamo';
import { DashboardWidget } from './types';

const TABLE_NAME = process.env.DASHBOARD_WIDGETS_TABLE || '';

export async function getWidgets(dashboardId: string): Promise<DashboardWidget[]> {
  if (!TABLE_NAME) return [];
  const items = await queryAllItems<DashboardWidget>({
    TableName: TABLE_NAME,
    IndexName: 'byDashboard',
    KeyConditionExpression: 'dashboardId = :did',
    ExpressionAttributeValues: { ':did': dashboardId },
  });
  return items.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function addWidget(widget: Omit<DashboardWidget, 'id' | 'createdAt'>): Promise<DashboardWidget> {
  if (!TABLE_NAME) throw new Error('DASHBOARD_WIDGETS_TABLE not configured');
  const item: DashboardWidget = {
    ...widget,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

export async function updateWidget(
  id: string,
  updates: Partial<Pick<DashboardWidget, 'sortOrder' | 'config'>>,
): Promise<void> {
  if (!TABLE_NAME) throw new Error('DASHBOARD_WIDGETS_TABLE not configured');
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

export async function deleteWidget(id: string): Promise<void> {
  if (!TABLE_NAME) throw new Error('DASHBOARD_WIDGETS_TABLE not configured');
  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id } }));
}

export async function getWidgetsByType(widgetTypeId: string): Promise<DashboardWidget[]> {
  if (!TABLE_NAME) return [];
  return scanAllItems<DashboardWidget>({
    TableName: TABLE_NAME,
    FilterExpression: 'widgetTypeId = :wt',
    ExpressionAttributeValues: { ':wt': widgetTypeId },
  });
}

export async function deleteWidgetsByDashboard(dashboardId: string): Promise<void> {
  const widgets = await getWidgets(dashboardId);
  await Promise.all(widgets.map(w => deleteWidget(w.id)));
}
