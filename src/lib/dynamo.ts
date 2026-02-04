import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
  ScanCommand,
  ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client);

export async function queryAllItems<T = Record<string, unknown>>(
  params: Omit<QueryCommandInput, 'ExclusiveStartKey'>,
): Promise<T[]> {
  const items: T[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const response = await docClient.send(new QueryCommand({
      ...params,
      ExclusiveStartKey: lastEvaluatedKey,
    }));

    if (response.Items) {
      items.push(...(response.Items as T[]));
    }

    lastEvaluatedKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return items;
}

export async function scanAllItems<T = Record<string, unknown>>(
  params: Omit<ScanCommandInput, 'ExclusiveStartKey'>,
): Promise<T[]> {
  const items: T[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const response = await docClient.send(new ScanCommand({
      ...params,
      ExclusiveStartKey: lastEvaluatedKey,
    }));

    if (response.Items) {
      items.push(...(response.Items as T[]));
    }

    lastEvaluatedKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return items;
}
