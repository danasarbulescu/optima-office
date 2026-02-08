import { ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, scanAllItems } from './dynamo';
import { EntityConfig } from './types';
import { SandboxConfig } from './sandboxes';

export interface SyncPreview {
  sourceTable: string;
  destinationTable: string;
  sourceItemCount: number;
  destinationItemCount: number;
  sourceItems: EntityConfig[];
}

export interface SyncReport {
  sourceLabel: string;
  destinationLabel: string;
  sourceTable: string;
  destinationTable: string;
  itemsCopied: number;
  itemsDeletedFromDestination: number;
  copiedItems: EntityConfig[];
}

async function discoverEntitiesTable(prefix: string): Promise<string> {
  const tableNames: string[] = [];
  let exclusiveStartTableName: string | undefined;

  do {
    const response = await docClient.send(new ListTablesCommand({
      ExclusiveStartTableName: exclusiveStartTableName,
    }));

    if (response.TableNames) {
      tableNames.push(...response.TableNames);
    }

    exclusiveStartTableName = response.LastEvaluatedTableName;
  } while (exclusiveStartTableName);

  // Look for Entities table (new) or Clients table (legacy) by prefix
  const match = tableNames.find(
    (name) => name.startsWith(prefix) && (name.includes('Entities') || name.includes('Clients')),
  );

  if (!match) {
    throw new Error(`Could not find Entities table for prefix: ${prefix}`);
  }

  return match;
}

async function clearTable(tableName: string): Promise<number> {
  const items = await scanAllItems<{ id: string }>({
    TableName: tableName,
    ProjectionExpression: 'id',
  });

  for (const item of items) {
    await docClient.send(new DeleteCommand({
      TableName: tableName,
      Key: { id: item.id },
    }));
  }

  return items.length;
}

async function batchWriteItems(tableName: string, items: EntityConfig[]): Promise<void> {
  const BATCH_SIZE = 25;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const writeRequests = batch.map((item) => ({
      PutRequest: { Item: item },
    }));

    await docClient.send(new BatchWriteCommand({
      RequestItems: { [tableName]: writeRequests },
    }));
  }
}

export async function previewSync(
  source: SandboxConfig,
  destination: SandboxConfig,
): Promise<SyncPreview> {
  const [sourceTable, destinationTable] = await Promise.all([
    discoverEntitiesTable(source.tablePrefix),
    discoverEntitiesTable(destination.tablePrefix),
  ]);

  const [sourceItems, destinationItems] = await Promise.all([
    scanAllItems<EntityConfig>({ TableName: sourceTable }),
    scanAllItems<EntityConfig>({ TableName: destinationTable }),
  ]);

  return {
    sourceTable,
    destinationTable,
    sourceItemCount: sourceItems.length,
    destinationItemCount: destinationItems.length,
    sourceItems,
  };
}

export async function executeSync(
  source: SandboxConfig,
  destination: SandboxConfig,
): Promise<SyncReport> {
  const [sourceTable, destinationTable] = await Promise.all([
    discoverEntitiesTable(source.tablePrefix),
    discoverEntitiesTable(destination.tablePrefix),
  ]);

  const sourceItems = await scanAllItems<EntityConfig>({ TableName: sourceTable });
  const deletedCount = await clearTable(destinationTable);
  await batchWriteItems(destinationTable, sourceItems);

  return {
    sourceLabel: source.label,
    destinationLabel: destination.label,
    sourceTable,
    destinationTable,
    itemsCopied: sourceItems.length,
    itemsDeletedFromDestination: deletedCount,
    copiedItems: sourceItems,
  };
}
