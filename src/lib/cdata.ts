import axios from 'axios';

export interface CDataPLRow {
  account: string;
  RowGroup: string;
  RowType: string;
  RowId: string | null;
  [key: string]: any;
}

const CDATA_ENDPOINT = 'https://cloud.cdata.com/api/query';

async function queryCData(
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
