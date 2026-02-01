export interface TokenData {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  realmId: string;
  createdAt: number;
}

export interface ReportRequest {
  reportType: 'ProfitAndLoss' | 'BalanceSheet' | 'CashFlow';
  startDate: string;
  endDate: string;
}

export interface CLIArgs {
  start: string;
  end: string;
}
