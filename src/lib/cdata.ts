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

// ── Account-level P&L actuals ─────────────────────────────────────────────────

export interface AccountActualRow {
  accountCode: string | null; // "4004-00" parsed from "4004-00 Wash Sales"
  accountName: string;        // "Wash Sales"
  rawAccount: string;         // original value e.g. "4004-00 Wash Sales"
  rowGroup: string;           // "Income", "COGS", etc.
  amount: number;
}

/** Convert "2026-01" → "Jan_2026" for use as a CData column name */
function periodToColName(period: string): string {
  const [year, month] = period.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(month, 10) - 1]}_${year}`;
}

/**
 * Fetch account-level P&L actuals from a specific class table (e.g., PL_2100000000001402200).
 * Returns one row per account with amount for the given period.
 *
 * CData class-specific PL tables use RowType='Section' for account rows (not 'Account').
 * Account names are indented with leading spaces; we trim before extracting codes.
 */
export async function fetchAccountLevelPL(
  cdataUser: string,
  cdataPat: string,
  cdataCatalog: string,
  tableName: string,
  period: string,
): Promise<AccountActualRow[]> {
  const col = periodToColName(period);
  const sql = `SELECT account, RowGroup, ${col} FROM ${cdataCatalog}.QuickBooksOnline.${tableName} WHERE RowType = 'Section'`;
  const results = await queryCData(cdataUser, cdataPat, sql);
  const codePattern = /^(\d{4}-\d{2})\s+(.+)$/;
  return results
    .map(r => {
      const raw = ((r.account ?? '') as string).trim();
      const m = codePattern.exec(raw);
      const amt = r[col];
      return {
        accountCode: m ? m[1] : null,
        accountName: m ? m[2] : raw,
        rawAccount: (r.account ?? '') as string,
        rowGroup: (r.RowGroup ?? '') as string,
        amount: typeof amt === 'number' ? amt : parseFloat(amt ?? '0') || 0,
      };
    })
    .filter(r => r.accountCode !== null);
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
