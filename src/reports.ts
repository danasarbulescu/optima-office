import { ReportRequest } from './types';

const REPORT_ENDPOINTS: Record<ReportRequest['reportType'], string> = {
  ProfitAndLoss: 'reports/ProfitAndLoss',
  BalanceSheet: 'reports/BalanceSheet',
  CashFlow: 'reports/CashFlow',
};

export async function fetchReport(
  oauthClient: any,
  request: ReportRequest
): Promise<any> {
  const realmId = oauthClient.token.realmId;
  const endpoint = REPORT_ENDPOINTS[request.reportType];
  const url = `v3/company/${realmId}/${endpoint}`;

  const params: Record<string, string> = {};
  if (request.reportType === 'BalanceSheet') {
    // Balance Sheet uses a single date, not a range
    params.date_macro = '';
    params.end_date = request.endDate;
  } else {
    params.start_date = request.startDate;
    params.end_date = request.endDate;
  }

  const response = await oauthClient.makeApiCall({ url, method: 'GET', params });
  return response.json;
}

export async function fetchAllReports(
  oauthClient: any,
  startDate: string,
  endDate: string
): Promise<{ reportType: ReportRequest['reportType']; data: any }[]> {
  const reportTypes: ReportRequest['reportType'][] = [
    'ProfitAndLoss',
    'BalanceSheet',
    'CashFlow',
  ];

  const results = [];
  for (const reportType of reportTypes) {
    console.log(`Fetching ${reportType}...`);
    const data = await fetchReport(oauthClient, { reportType, startDate, endDate });
    results.push({ reportType, data });
    console.log(`  ${reportType} fetched successfully.`);
  }

  return results;
}
