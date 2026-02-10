import { FinancialRow } from '../models/financial';

export interface DataAdapter {
  fetchFinancialData(
    sourceConfig: Record<string, string>,
    credentials: Record<string, string>,
  ): Promise<FinancialRow[]>;
}
