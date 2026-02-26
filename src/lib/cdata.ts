import axios from 'axios';

export interface CDataPLRow {
  account: string;
  RowGroup: string;
  RowType: string;
  RowId: string | null;
  [key: string]: any;
}

const CDATA_ENDPOINT = 'https://cloud.cdata.com/api/query';

export async function queryCData(
  cdataUser: string,
  cdataPat: string,
  sql: string,
): Promise<Record<string, any>[]> {
  const auth = Buffer.from(`${cdataUser}:${cdataPat}`).toString('base64');

  const response = await axios.post(
    CDATA_ENDPOINT,
    { query: sql },
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const resultSet = response.data.results?.[0];
  if (!resultSet?.schema || !resultSet?.rows) return [];

  const colNames = resultSet.schema.map((col: any) => col.columnName);
  return resultSet.rows.map((row: any[]) => {
    const obj: Record<string, any> = {};
    for (let i = 0; i < colNames.length; i++) {
      obj[colNames[i]] = row[i];
    }
    return obj;
  });
}

export async function fetchPLSummaries(
  cdataUser: string,
  cdataPat: string,
  cdataCatalog: string,
): Promise<CDataPLRow[]> {
  if (!cdataUser || !cdataPat || !cdataCatalog) {
    throw new Error(
      'Missing CData credentials. Provide CDATA_USER, CDATA_PAT, and CDATA_CATALOG.',
    );
  }

  const sql = `SELECT * FROM ${cdataCatalog}.QuickBooksOnline.PL WHERE RowType = 'Summary' AND RowId IS NULL`;
  const results = await queryCData(cdataUser, cdataPat, sql);
  return results as CDataPLRow[];
}

/**
 * Fetch P&L summary data from a specific table (e.g., PL_2100000000001402200).
 */
export async function fetchPLFromTable(
  cdataUser: string,
  cdataPat: string,
  cdataCatalog: string,
  tableName: string,
): Promise<CDataPLRow[]> {
  const sql = `SELECT * FROM ${cdataCatalog}.QuickBooksOnline.${tableName} WHERE RowType = 'Summary' AND RowId IS NULL`;
  const results = await queryCData(cdataUser, cdataPat, sql);
  return results as CDataPLRow[];
}

/**
 * Discover PL_XXX class tables from the catalog's sys_tables.
 * Returns table names like ['PL_2100000000001402200', 'PL_2100000000001402201', ...].
 */
export async function fetchPLClassTables(
  cdataUser: string,
  cdataPat: string,
  cdataCatalog: string,
): Promise<string[]> {
  const sql = `SELECT TableName FROM ${cdataCatalog}.QuickBooksOnline.sys_tables`;
  const results = await queryCData(cdataUser, cdataPat, sql);
  return results
    .map(r => r.TableName as string)
    .filter(name => /^PL_\d+$/.test(name));
}

/**
 * Fetch class ID → display name mapping from the QuickBooks Class table.
 */
export async function fetchClassNames(
  cdataUser: string,
  cdataPat: string,
  cdataCatalog: string,
): Promise<Map<string, string>> {
  const sql = `SELECT Id, FullyQualifiedName FROM ${cdataCatalog}.QuickBooksOnline.Class`;
  const results = await queryCData(cdataUser, cdataPat, sql);
  const map = new Map<string, string>();
  for (const row of results) {
    if (row.Id && row.FullyQualifiedName) {
      map.set(row.Id as string, row.FullyQualifiedName as string);
    }
  }
  return map;
}
