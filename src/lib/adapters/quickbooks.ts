import { DataAdapter } from './base';
import { FinancialRow } from '../models/financial';
import { fetchPLSummaries, fetchPLFromTable, fetchPLClassTables, fetchClassNames, CDataPLRow } from '../cdata';

export interface ClassPLResult {
  classId: string;
  className: string;
  tableName: string;
  rows: FinancialRow[];
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_PATTERN = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)_(\d{4})$/;

export function normalizePLRow(row: CDataPLRow): FinancialRow {
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
    // CData returns multiple rows per RowGroup (sub-group totals followed by the group total).
    // Deduplicate by RowGroup keeping the last row per group, which is always the group total
    // (e.g., "Total Expenses" for Expenses). Without this, mergeFinancialRows sums all
    // sub-group totals + the overall total, producing inflated values in combined-entity views.
    const byGroup = new Map<string, CDataPLRow>();
    for (const row of rawRows) {
      byGroup.set(row.RowGroup, row);
    }
    return Array.from(byGroup.values()).map(normalizePLRow);
  }

  /**
   * Discover PL_XXX class tables, resolve class names, and fetch each class's P&L data.
   */
  async discoverAndFetchClasses(
    sourceConfig: Record<string, string>,
    credentials: Record<string, string>,
  ): Promise<ClassPLResult[]> {
    const catalog = sourceConfig.catalogId;
    const { user, pat } = credentials;

    // Discover PL_XXX tables
    const classTables = await fetchPLClassTables(user, pat, catalog);
    if (classTables.length === 0) return [];

    // Fetch class names in parallel with P&L data
    const [classNameMap, ...plResults] = await Promise.all([
      fetchClassNames(user, pat, catalog),
      ...classTables.map(table => fetchPLFromTable(user, pat, catalog, table)),
    ]);

    return classTables.map((tableName, i) => {
      const classId = tableName.replace('PL_', '');
      return {
        classId,
        className: classNameMap.get(classId) || classId,
        tableName,
        rows: plResults[i].map(normalizePLRow),
      };
    });
  }
}
