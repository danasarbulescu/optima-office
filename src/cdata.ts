import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const CDATA_ENDPOINT = 'https://cloud.cdata.com/api/query';
const CDATA_USER = process.env.CDATA_USER || '';
const CDATA_PAT = process.env.CDATA_PAT || '';
const CDATA_CATALOG = process.env.CDATA_CATALOG || '';

export interface CDataPLRow {
  account: string;
  RowGroup: string;
  RowType: string;
  RowId: string | null;
  [key: string]: any;
}

export type GroupValues = Map<string, number[]>;

async function queryCData(sql: string): Promise<Record<string, any>[]> {
  const auth = Buffer.from(`${CDATA_USER}:${CDATA_PAT}`).toString('base64');

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

  // CData returns { results: [{ schema: [...], rows: [[...], ...] }] }
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

export async function fetchPLSummaries(): Promise<CDataPLRow[]> {
  if (!CDATA_USER || !CDATA_PAT || !CDATA_CATALOG) {
    throw new Error(
      'Missing CData credentials. Set CDATA_USER, CDATA_PAT, and CDATA_CATALOG in .env',
    );
  }

  const sql = `SELECT * FROM ${CDATA_CATALOG}.QuickBooksOnline.PL WHERE RowType = 'Summary' AND RowId IS NULL`;
  const results = await queryCData(sql);
  return results as CDataPLRow[];
}

export function buildGroupValues(rows: CDataPLRow[], year: number): GroupValues {
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const map: GroupValues = new Map();

  for (const row of rows) {
    const values: number[] = [];
    for (let m = 0; m < 12; m++) {
      const colName = `${monthNames[m]}_${year}`;
      values.push(parseFloat(row[colName]) || 0);
    }
    // Index 12 = computed annual total
    values.push(values.reduce((a, b) => a + b, 0));
    map.set(row.RowGroup, values);
  }

  return map;
}
