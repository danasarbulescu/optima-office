import { CDataPLRow } from './types';

const META_KEYS = new Set(['account', 'RowGroup', 'RowType', 'RowId']);

/**
 * Merge multiple companies' P&L summary rows into one combined array.
 * Rows are grouped by RowGroup. All numeric columns are summed.
 */
export function mergePLRows(...rowSets: CDataPLRow[][]): CDataPLRow[] {
  const grouped = new Map<string, CDataPLRow>();

  for (const rows of rowSets) {
    for (const row of rows) {
      const key = row.RowGroup;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, { ...row });
      } else {
        for (const col of Object.keys(row)) {
          if (META_KEYS.has(col)) continue;
          const val = parseFloat(row[col]);
          if (!isNaN(val)) {
            existing[col] = (parseFloat(existing[col]) || 0) + val;
          }
        }
      }
    }
  }

  return Array.from(grouped.values());
}
