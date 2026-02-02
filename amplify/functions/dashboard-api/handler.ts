import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { fetchPLSummaries } from '../../../src/lib/cdata';
import { buildGroupValues, computeKPIs, build13MonthPnL } from '../../../src/lib/compute';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json',
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const month = event.queryStringParameters?.month;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Missing or invalid month parameter. Use ?month=YYYY-MM' }),
    };
  }

  const [yearStr, moStr] = month.split('-');
  const year = Number(yearStr);
  const monthIdx = parseInt(moStr, 10) - 1;

  try {
    const plRows = await fetchPLSummaries(
      process.env.CDATA_USER ?? '',
      process.env.CDATA_PAT ?? '',
      process.env.CDATA_CATALOG ?? '',
    );

    if (plRows.length === 0) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'No P&L summary data returned from CData.' }),
      };
    }

    const curGroups = buildGroupValues(plRows, year);
    const pyGroups = buildGroupValues(plRows, year - 1);
    const pyHasData = [...pyGroups.values()].some(arr => arr.slice(0, 12).some(v => v !== 0));

    const kpis = computeKPIs(curGroups, pyHasData ? pyGroups : null, monthIdx);
    const pnlByMonth = build13MonthPnL(curGroups, pyHasData ? pyGroups : null, month);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ kpis, pnlByMonth, selectedMonth: month }),
    };
  } catch (err: any) {
    console.error('Dashboard API error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
