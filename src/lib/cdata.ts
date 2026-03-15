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
 * CData class-specific PL tables use three RowTypes:
 *   - 'Section' for parent/group account rows (e.g., "4004-00 Wash Sales")
 *   - 'Data' for leaf account rows (e.g., "4013-00 Lottery Sales")
 *   - 'Summary' for subtotal rows (e.g., "Total 4004-00 Wash Sales")
 *
 * We include both Section and Data rows (excluding Summary to avoid double-counting)
 * and aggregate by account code in case the same code appears in both row types.
 */
export async function fetchAccountLevelPL(
  cdataUser: string,
  cdataPat: string,
  cdataCatalog: string,
  tableName: string,
  period: string,
): Promise<AccountActualRow[]> {
  const col = periodToColName(period);
  const sql = `SELECT account, RowGroup, ${col} FROM ${cdataCatalog}.QuickBooksOnline.${tableName} WHERE RowType != 'Summary'`;
  const results = await queryCData(cdataUser, cdataPat, sql);
  const codePattern = /^(\d{4}-\d{2})\s+(.+)$/;

  // Aggregate by account code to handle cases where the same code appears
  // in both Section and Data rows
  const byCode = new Map<string, AccountActualRow>();

  for (const r of results) {
    const raw = ((r.account ?? '') as string).trim();
    const m = codePattern.exec(raw);
    if (!m) continue; // skip rows without a proper account code

    const code = m[1];
    const amt = r[col];
    const amount = typeof amt === 'number' ? amt : parseFloat(amt ?? '0') || 0;

    const existing = byCode.get(code);
    if (existing) {
      existing.amount += amount;
    } else {
      byCode.set(code, {
        accountCode: code,
        accountName: m[2],
        rawAccount: (r.account ?? '') as string,
        rowGroup: (r.RowGroup ?? '') as string,
        amount,
      });
    }
  }

  return Array.from(byCode.values());
}

// ── Car count actuals ───────────────────────────────────────────────────────

export interface CarCountRow {
  date: string;       // "2025-10-31"
  classId: string;    // Class_Id column
  className: string;  // Class column (e.g. "06 - Huntington Harbor")
  num: string;        // Num column (contains "daily" keyword for daily entries)
  debit: number;      // Car count value
}

/**
 * Fetch car count journal entries from the CarCount CData table for a given month.
 * Returns raw rows; caller is responsible for aggregation (daily → monthly).
 *
 * Uses date range filtering: Date >= first-of-month AND Date < first-of-next-month.
 */
export async function fetchCarCountData(
  cdataUser: string,
  cdataPat: string,
  cdataCatalog: string,
  period: string, // "2026-01"
): Promise<CarCountRow[]> {
  const [yearStr, moStr] = period.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(moStr, 10);
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  // First day of next month
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const endDate = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

  const sql = `SELECT Date, Class_Id, Class, Num, Debit FROM ${cdataCatalog}.QuickBooksOnline.CarCount WHERE Date >= '${startDate}' AND Date < '${endDate}'`;
  const results = await queryCData(cdataUser, cdataPat, sql);

  return results.map(r => ({
    date: (r.Date ?? '') as string,
    classId: (r.Class_Id ?? '') as string,
    className: (r.Class ?? '') as string,
    num: (r.Num ?? '') as string,
    debit: typeof r.Debit === 'number' ? r.Debit : parseFloat(r.Debit ?? '0') || 0,
  }));
}

/**
 * Aggregate CarCountRow[] into a Map<classId, totalDebit> for one month.
 * Sums all entries (daily + monthly) per class.
 */
export function aggregateCarCountByClass(rows: CarCountRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.classId) continue;
    map.set(row.classId, (map.get(row.classId) ?? 0) + row.debit);
  }
  return map;
}

// ── Gallons actuals ───────────────────────────────────────────────────────

export interface GallonsRow {
  date: string;       // "2025-10-31"
  classId: string;    // Class_Id column
  className: string;  // Class column
  num: string;        // Num column
  debit: number;      // Gallons value
}

/**
 * Fetch gallons journal entries from the Gallons CData table for a given month.
 * Returns raw rows; caller is responsible for aggregation (daily → monthly).
 */
export async function fetchGallonsData(
  cdataUser: string,
  cdataPat: string,
  cdataCatalog: string,
  period: string, // "2026-01"
): Promise<GallonsRow[]> {
  const [yearStr, moStr] = period.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(moStr, 10);
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const endDate = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

  const sql = `SELECT Date, Class_Id, Class, Num, Debit FROM ${cdataCatalog}.QuickBooksOnline.Gallons WHERE Date >= '${startDate}' AND Date < '${endDate}'`;
  const results = await queryCData(cdataUser, cdataPat, sql);

  return results.map(r => ({
    date: (r.Date ?? '') as string,
    classId: (r.Class_Id ?? '') as string,
    className: (r.Class ?? '') as string,
    num: (r.Num ?? '') as string,
    debit: typeof r.Debit === 'number' ? r.Debit : parseFloat(r.Debit ?? '0') || 0,
  }));
}

/**
 * Aggregate GallonsRow[] into a Map<classId, totalDebit> for one month.
 */
export function aggregateGallonsByClass(rows: GallonsRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.classId) continue;
    map.set(row.classId, (map.get(row.classId) ?? 0) + row.debit);
  }
  return map;
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
