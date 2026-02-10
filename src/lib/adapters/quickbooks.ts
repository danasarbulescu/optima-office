import { DataAdapter } from './base';
import { FinancialRow } from '../models/financial';
import { fetchPLSummaries, CDataPLRow } from '../cdata';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_PATTERN = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)_(\d{4})$/;

function normalizePLRow(row: CDataPLRow): FinancialRow {
  const periods: Record<string, number> = {};

  for (const key of Object.keys(row)) {
    const match = MONTH_PATTERN.exec(key);
    if (!match) continue;

    const monthName = match[1];
    const year = match[2];
    const monthIdx = MONTH_NAMES.indexOf(monthName);
    if (monthIdx < 0) continue;

    const val = parseFloat(row[key]);
    if (!isNaN(val)) {
      periods[`${year}-${String(monthIdx + 1).padStart(2, '0')}`] = val;
    }
  }

  return { category: row.RowGroup, periods };
}

export class QuickBooksAdapter implements DataAdapter {
  async fetchFinancialData(sourceConfig: Record<string, string>, credentials: Record<string, string>): Promise<FinancialRow[]> {
    const rawRows = await fetchPLSummaries(credentials.user, credentials.pat, sourceConfig.catalogId);
    return rawRows.map(normalizePLRow);
  }
}
