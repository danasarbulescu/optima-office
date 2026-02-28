/**
 * DynamoDB CRUD for BudgetData table.
 *
 * SK patterns:
 *   "budget#{year}#metadata"           → BudgetMetadataItem (class index for this entity+year)
 *   "budget#{year}#class#{classId}"    → BudgetClassData (all lines + metrics for one class)
 */

import { GetCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, queryAllItems } from './dynamo';
import { BudgetClassData, BudgetMetadataItem } from './types';

const TABLE_NAME = process.env.BUDGET_DATA_TABLE || '';

function sk(year: number, classId: string): string {
  return `budget#${year}#class#${classId}`;
}

function skMeta(year: number): string {
  return `budget#${year}#metadata`;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Write (upsert) budget data for one class.
 * Overwrites any existing budget data for this entity + year + class.
 */
export async function setBudgetClassData(data: BudgetClassData): Promise<void> {
  if (!TABLE_NAME) throw new Error('BUDGET_DATA_TABLE not configured');
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: data }));
}

/**
 * Write (upsert) the metadata index for an entity+year.
 * Call after importing all classes for a given fiscal year.
 */
export async function setBudgetMetadata(item: BudgetMetadataItem): Promise<void> {
  if (!TABLE_NAME) throw new Error('BUDGET_DATA_TABLE not configured');
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Get budget data for a specific class within an entity+year.
 * Returns null if no budget has been imported yet.
 */
export async function getBudgetClassData(
  entityId: string,
  year: number,
  classId: string,
): Promise<BudgetClassData | null> {
  if (!TABLE_NAME) return null;
  const resp = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { entityId, sk: sk(year, classId) },
  }));
  return (resp.Item as BudgetClassData) ?? null;
}

/**
 * Get all budget class data items for an entity+year (all classes).
 * Returns an empty array if no budget has been imported.
 */
export async function getAllBudgetClassData(
  entityId: string,
  year: number,
): Promise<BudgetClassData[]> {
  if (!TABLE_NAME) return [];
  const prefix = `budget#${year}#class#`;
  const items = await queryAllItems<BudgetClassData>({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'entityId = :eid AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':eid': entityId, ':prefix': prefix },
  });
  return items;
}

/**
 * Get the metadata index (list of imported classes) for an entity+year.
 */
export async function getBudgetMetadata(
  entityId: string,
  year: number,
): Promise<BudgetMetadataItem | null> {
  if (!TABLE_NAME) return null;
  const resp = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { entityId, sk: skMeta(year) },
  }));
  return (resp.Item as BudgetMetadataItem) ?? null;
}

/**
 * List all fiscal years that have budget data for an entity.
 * Scans SK patterns to extract distinct years.
 */
export async function getBudgetYears(entityId: string): Promise<number[]> {
  if (!TABLE_NAME) return [];
  const resp = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'entityId = :eid AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':eid': entityId, ':prefix': 'budget#' },
    ProjectionExpression: 'sk',
  }));
  const years = new Set<number>();
  for (const item of resp.Items ?? []) {
    // SK: "budget#2026#metadata" or "budget#2026#class#..."
    const m = (item.sk as string).match(/^budget#(\d{4})#/);
    if (m) years.add(parseInt(m[1], 10));
  }
  return Array.from(years).sort();
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Delete budget data for a specific class.
 */
export async function deleteBudgetClassData(
  entityId: string,
  year: number,
  classId: string,
): Promise<void> {
  if (!TABLE_NAME) return;
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { entityId, sk: sk(year, classId) },
  }));
}

/**
 * Delete all budget data for an entity+year (all classes + metadata).
 */
export async function deleteBudgetYear(entityId: string, year: number): Promise<void> {
  if (!TABLE_NAME) return;
  const prefix = `budget#${year}#`;
  const items = await queryAllItems<{ entityId: string; sk: string }>({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'entityId = :eid AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':eid': entityId, ':prefix': prefix },
    ProjectionExpression: 'entityId, sk',
  });
  for (const item of items) {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { entityId: item.entityId, sk: item.sk },
    }));
  }
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * Get budget amount for a specific account code, class, period.
 * Returns null if not found.
 */
export function getBudgetAmountForAccount(
  classData: BudgetClassData,
  accountCode: string,
  period: string,
): number | null {
  const line = classData.budgetLines.find(l => l.accountCode === accountCode);
  if (!line) return null;
  return line.monthly[period] ?? null;
}

/**
 * Get annual budget total for a specific account code from a class.
 */
export function getBudgetAnnualForAccount(
  classData: BudgetClassData,
  accountCode: string,
): number | null {
  const line = classData.budgetLines.find(l => l.accountCode === accountCode);
  return line?.annualTotal ?? null;
}

/**
 * Get a metric value for a specific key and period.
 */
export function getBudgetMetricValue(
  classData: BudgetClassData,
  metricKey: string,
  period: string,
): number | null {
  const metric = classData.metrics.find(m => m.key === metricKey);
  if (!metric) return null;
  if (metric.monthly) return metric.monthly[period] ?? null;
  return metric.constant;
}
