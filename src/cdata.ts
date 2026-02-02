import * as dotenv from 'dotenv';
import { fetchPLSummaries as fetchPL } from './lib/cdata';

dotenv.config();

// Re-export types for backward compatibility
export type { CDataPLRow, GroupValues } from './lib/types';
export { buildGroupValues } from './lib/compute';

const CDATA_USER = process.env.CDATA_USER || '';
const CDATA_PAT = process.env.CDATA_PAT || '';
const CDATA_CATALOG = process.env.CDATA_CATALOG || '';

export async function fetchPLSummaries() {
  return fetchPL(CDATA_USER, CDATA_PAT, CDATA_CATALOG);
}
