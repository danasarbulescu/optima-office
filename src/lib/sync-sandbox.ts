import { ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, scanAllItems } from './dynamo';
import { SandboxConfig } from './sandboxes';

/* ── Table descriptor registry ─────────────────────────────────── */

export interface SyncTableDescriptor {
  typeKey: string;
  cdkLogicalId: string;   // Exact CDK logical ID before the hex hash
  pkField: string;         // Partition key field: "id" or "userId" or "entityId"
  skField?: string;        // Optional sort key field (e.g. "sk" for composite-key tables)
  displayLabel: string;
}

export const SYNC_TABLES: SyncTableDescriptor[] = [
  { typeKey: 'clients',           cdkLogicalId: 'Clients',           pkField: 'id',     displayLabel: 'Clients' },
  { typeKey: 'entities',          cdkLogicalId: 'Entities',          pkField: 'id',     displayLabel: 'Entities' },
  { typeKey: 'clientMemberships', cdkLogicalId: 'ClientMemberships', pkField: 'userId', displayLabel: 'Client Memberships' },
  { typeKey: 'clientUsers',       cdkLogicalId: 'ClientUsers',       pkField: 'id',     displayLabel: 'Client Users' },
  { typeKey: 'dataSources',       cdkLogicalId: 'DataSources',       pkField: 'id',     displayLabel: 'Data Sources' },
  { typeKey: 'packages',          cdkLogicalId: 'Packages',          pkField: 'id',     displayLabel: 'Packages' },
  { typeKey: 'dashboards',        cdkLogicalId: 'Dashboards',        pkField: 'id',     displayLabel: 'Dashboards' },
  { typeKey: 'dashboardWidgets',  cdkLogicalId: 'DashboardWidgets',  pkField: 'id',     displayLabel: 'Dashboard Widgets' },
  { typeKey: 'widgetTypeMeta',    cdkLogicalId: 'WidgetTypeMeta',    pkField: 'id',     displayLabel: 'Widget Type Meta' },
  { typeKey: 'budgetData',        cdkLogicalId: 'BudgetData',        pkField: 'entityId', skField: 'sk', displayLabel: 'Budget Data' },
];

/* ── Types ─────────────────────────────────────────────────────── */

export interface TableSyncPreview {
  typeKey: string;
  displayLabel: string;
  sourceItemCount: number;
  destinationItemCount: number;
}

export interface MultiSyncPreview {
  tables: TableSyncPreview[];
  totalSourceItems: number;
  totalDestinationItems: number;
}

export interface TableSyncReport {
  typeKey: string;
  displayLabel: string;
  itemsCopied: number;
  itemsDeletedFromDestination: number;
}

export interface MultiSyncReport {
  sourceLabel: string;
  destinationLabel: string;
  tables: TableSyncReport[];
  totalItemsCopied: number;
  totalItemsDeleted: number;
  copiedClientNames: { id: string; displayName: string }[];
}

/* ── Table discovery ───────────────────────────────────────────── */

type DiscoveredTables = Record<string, string>; // typeKey → actual table name

async function discoverTables(prefix: string): Promise<DiscoveredTables> {
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

  const prefixedTables = tableNames.filter((name) => name.startsWith(prefix));

  // CDK appends an 8-char hex hash to the logical ID, e.g. Clients67031123
  // The regex ensures "Clients" matches "Clients67031123" but NOT "ClientMemberships68C02252"
  const result: DiscoveredTables = {};
  for (const descriptor of SYNC_TABLES) {
    const pattern = new RegExp(`${descriptor.cdkLogicalId}[A-F0-9]{8}`);
    const match = prefixedTables.find((name) => pattern.test(name));

    if (!match) {
      throw new Error(`Could not find ${descriptor.displayLabel} table for prefix: ${prefix}`);
    }

    result[descriptor.typeKey] = match;
  }

  return result;
}

/* ── Generic table operations ──────────────────────────────────── */

async function clearTable(tableName: string, pkField: string, skField?: string): Promise<number> {
  const projection = skField ? `${pkField}, ${skField}` : pkField;
  const items = await scanAllItems<Record<string, unknown>>({
    TableName: tableName,
    ProjectionExpression: projection,
  });

  for (const item of items) {
    const key: Record<string, unknown> = { [pkField]: item[pkField] };
    if (skField) key[skField] = item[skField];
    await docClient.send(new DeleteCommand({
      TableName: tableName,
      Key: key,
    }));
  }

  return items.length;
}

async function batchWriteItems(tableName: string, items: Record<string, unknown>[]): Promise<void> {
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

/* ── Preview ───────────────────────────────────────────────────── */

export async function previewSync(
  source: SandboxConfig,
  destination: SandboxConfig,
): Promise<MultiSyncPreview> {
  const [sourceTables, destTables] = await Promise.all([
    discoverTables(source.tablePrefix),
    discoverTables(destination.tablePrefix),
  ]);

  const tables: TableSyncPreview[] = await Promise.all(
    SYNC_TABLES.map(async (descriptor) => {
      const projection = descriptor.skField
        ? `${descriptor.pkField}, ${descriptor.skField}`
        : descriptor.pkField;
      const [sourceItems, destItems] = await Promise.all([
        scanAllItems<Record<string, unknown>>({
          TableName: sourceTables[descriptor.typeKey],
          ProjectionExpression: projection,
        }),
        scanAllItems<Record<string, unknown>>({
          TableName: destTables[descriptor.typeKey],
          ProjectionExpression: projection,
        }),
      ]);

      return {
        typeKey: descriptor.typeKey,
        displayLabel: descriptor.displayLabel,
        sourceItemCount: sourceItems.length,
        destinationItemCount: destItems.length,
      };
    }),
  );

  return {
    tables,
    totalSourceItems: tables.reduce((sum, t) => sum + t.sourceItemCount, 0),
    totalDestinationItems: tables.reduce((sum, t) => sum + t.destinationItemCount, 0),
  };
}

/* ── Execute ───────────────────────────────────────────────────── */

export async function executeSync(
  source: SandboxConfig,
  destination: SandboxConfig,
): Promise<MultiSyncReport> {
  const [sourceTables, destTables] = await Promise.all([
    discoverTables(source.tablePrefix),
    discoverTables(destination.tablePrefix),
  ]);

  let copiedClientNames: { id: string; displayName: string }[] = [];
  const tables: TableSyncReport[] = [];

  // Sync tables sequentially to avoid overwhelming DynamoDB throughput
  for (const descriptor of SYNC_TABLES) {
    const sourceTable = sourceTables[descriptor.typeKey];
    const destTable = destTables[descriptor.typeKey];

    const sourceItems = await scanAllItems<Record<string, unknown>>({
      TableName: sourceTable,
    });

    // For ClientMemberships, preserve internal-admin records in destination
    let preservedAdmins: Record<string, unknown>[] = [];
    if (descriptor.typeKey === 'clientMemberships') {
      const destItems = await scanAllItems<Record<string, unknown>>({
        TableName: destTable,
      });
      preservedAdmins = destItems.filter((item) => item.role === 'internal-admin');
    }

    const deletedCount = await clearTable(destTable, descriptor.pkField, descriptor.skField);
    // Merge source items with preserved admins (source wins on userId conflict)
    const preservedUserIds = new Set(preservedAdmins.map((a) => a.userId));
    const itemsToWrite = descriptor.typeKey === 'clientMemberships'
      ? [...sourceItems.filter((item) => !preservedUserIds.has(item.userId)), ...preservedAdmins]
      : sourceItems;
    await batchWriteItems(destTable, itemsToWrite);

    if (descriptor.typeKey === 'clients') {
      copiedClientNames = sourceItems.map((item) => ({
        id: String(item.id ?? ''),
        displayName: String(item.displayName ?? ''),
      }));
    }

    tables.push({
      typeKey: descriptor.typeKey,
      displayLabel: descriptor.displayLabel,
      itemsCopied: sourceItems.length,
      itemsDeletedFromDestination: deletedCount - preservedAdmins.length,
    });
  }

  return {
    sourceLabel: source.label,
    destinationLabel: destination.label,
    tables,
    totalItemsCopied: tables.reduce((sum, t) => sum + t.itemsCopied, 0),
    totalItemsDeleted: tables.reduce((sum, t) => sum + t.itemsDeletedFromDestination, 0),
    copiedClientNames,
  };
}
