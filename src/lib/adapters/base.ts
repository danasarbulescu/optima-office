import { FinancialRow } from '../models/financial';

export interface DataSourceCredentials {
  user: string;
  pat: string;
}

export interface DataAdapter {
  fetchFinancialData(catalogId: string, credentials: DataSourceCredentials): Promise<FinancialRow[]>;
}
