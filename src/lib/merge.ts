import { FinancialRow } from './models/financial';

/**
 * Merge multiple companies' financial rows into one combined array.
 * Rows are grouped by category. All period values are summed.
 */
export function mergeFinancialRows(...rowSets: FinancialRow[][]): FinancialRow[] {
  const grouped = new Map<string, FinancialRow>();

  for (const rows of rowSets) {
    for (const row of rows) {
      const existing = grouped.get(row.category);

      if (!existing) {
        grouped.set(row.category, {
          category: row.category,
          periods: { ...row.periods },
        });
      } else {
        for (const [period, val] of Object.entries(row.periods)) {
          existing.periods[period] = (existing.periods[period] || 0) + val;
        }
      }
    }
  }

  return Array.from(grouped.values());
}
