export interface FinancialRow {
  category: string;                // "Income", "COGS", "GrossProfit", etc.
  periods: Record<string, number>; // "2024-01" → 12345.67
}

export interface FinancialDataSet {
  rows: FinancialRow[];
  fetchedAt: string;
}
