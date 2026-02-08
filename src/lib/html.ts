import { KPIs, PnLByMonth, PnLMonthEntry } from './types';
import { formatAbbrev, formatPct, formatVariance } from './format';

function generatePnLTableHTML(pnl: PnLByMonth): string {
  const rows: [string, keyof Omit<PnLMonthEntry, 'label'>, boolean | 'pct'][] = [
    ['Revenue',              'revenue',            false],
    ['Cost of Goods Sold',   'cogs',               false],
    ['Gross Profit',         'grossProfit',         true],
    ['GP%',                  'grossProfit',         'pct'],
    ['Operating Expenses',   'expenses',            false],
    ['Net Operating Income', 'netOperatingIncome',  true],
    ['Operating Profit %',   'netOperatingIncome',  'pct'],
    ['Other Expenses',       'otherExpenses',       false],
    ['Net Other Income',     'netOtherIncome',      false],
    ['Net Income',           'netIncome',           true],
    ['Net Income %',         'netIncome',           'pct'],
  ];

  const headerCells = pnl.months
    .map(m => `<th>${m.label}</th>`)
    .join('\n          ');

  const bodyRows = rows.map(([label, key, rowType]) => {
    if (rowType === 'pct') {
      const cells = pnl.months
        .map(m => {
          const pct = m.revenue !== 0 ? (m[key] / m.revenue) * 100 : 0;
          return `<td>${formatPct(pct)}</td>`;
        })
        .join('');
      const totalPct = pnl.totals.revenue !== 0
        ? (pnl.totals[key] / pnl.totals.revenue) * 100 : 0;
      const totalCell = `<td>${formatPct(totalPct)}</td>`;
      return `      <tr class="pct-row">
        <td class="row-label">${label}</td>
        ${cells}
        ${totalCell}
      </tr>`;
    }
    const cls = rowType ? ' class="summary-row"' : '';
    const cells = pnl.months
      .map(m => `<td>${formatAbbrev(m[key])}</td>`)
      .join('');
    const totalCell = `<td>${formatAbbrev(pnl.totals[key])}</td>`;
    return `      <tr${cls}>
        <td class="row-label">${label}</td>
        ${cells}
        ${totalCell}
      </tr>`;
  }).join('\n');

  return `
<!-- P&L by Month -->
<div class="pnl-section">
  <h2>P&amp;L by Month</h2>
  <div class="table-scroll">
    <table class="pnl-table">
      <thead>
        <tr>
          <th class="row-label"></th>
          ${headerCells}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
${bodyRows}
      </tbody>
    </table>
  </div>
</div>`;
}

export function generateHTML(kpis: KPIs, selectedMonth: string, pnlByMonth?: PnLByMonth, entityName?: string): string {
  const na = 'N/A';

  // Variance HTML helpers
  const varianceColor = (val: number | null) =>
    val === null ? '#999' : val >= 0 ? '#2ecc71' : '#e74c3c';

  const yoyRevHTML = kpis.yoyRevenueVariance !== null
    ? `<div class="variance" style="color:${varianceColor(kpis.yoyRevenueVariance)}">
        ${formatVariance(kpis.yoyRevenueVariance)}
        ${kpis.yoyRevenueVariancePct !== null ? `&nbsp;&nbsp;${kpis.yoyRevenueVariancePct >= 0 ? '+' : ''}${kpis.yoyRevenueVariancePct.toFixed(2)}%` : ''}
       </div>
       <div class="sub-label">YOY Variance</div>`
    : '';

  const niYoyHTML = kpis.netIncomeYoyVariance !== null
    ? `<div class="variance" style="color:${varianceColor(kpis.netIncomeYoyVariance)}">${formatVariance(kpis.netIncomeYoyVariance)}</div>`
    : '';

  // P&L by month table
  const pnlTableHTML = pnlByMonth ? generatePnLTableHTML(pnlByMonth) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${entityName ? `${entityName} — ` : ''}Financial Snapshot — ${selectedMonth}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f1117;
    color: #e1e2e8;
    padding: 40px 24px;
  }
  .entity-name {
    text-align: center;
    color: #9a9caa;
    font-size: 16px;
    letter-spacing: 1px;
    margin-bottom: 4px;
    text-transform: uppercase;
  }
  h1 {
    text-align: center;
    color: #6b8cff;
    font-size: 28px;
    letter-spacing: 2px;
    margin-bottom: 32px;
    text-transform: uppercase;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    max-width: 1200px;
    margin: 0 auto 24px;
  }
  .grid-5 {
    grid-template-columns: repeat(5, 1fr);
  }
  .card {
    background: #1a1b23;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    overflow: hidden;
    text-align: center;
    min-height: 140px;
    display: flex;
    flex-direction: column;
  }
  .card-header {
    background: #252636;
    color: #c0c4d0;
    padding: 12px 8px;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.3;
    text-transform: capitalize;
  }
  .card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 16px 8px 12px;
  }
  .kpi-value {
    font-size: 28px;
    font-weight: 700;
    color: #e1e2e8;
  }
  .variance {
    font-size: 13px;
    font-weight: 600;
    margin-top: 4px;
  }
  .sub-label {
    font-size: 11px;
    color: #6a6b78;
    margin-top: 2px;
  }
  @media (max-width: 900px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
    .grid-5 { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 600px) {
    .grid, .grid-5 { grid-template-columns: 1fr 1fr; }
  }
  /* P&L by Month table */
  .pnl-section {
    max-width: 1200px;
    margin: 40px auto 0;
  }
  .pnl-section h2 {
    color: #6b8cff;
    font-size: 20px;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 16px;
    text-align: center;
  }
  .table-scroll {
    overflow-x: auto;
    background: #1a1b23;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .pnl-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    white-space: nowrap;
    min-width: 900px;
  }
  .pnl-table thead th {
    background: #252636;
    color: #c0c4d0;
    padding: 10px 12px;
    font-weight: 700;
    text-align: right;
    position: sticky;
    top: 0;
  }
  .pnl-table thead th.row-label {
    text-align: left;
    min-width: 160px;
    position: sticky;
    left: 0;
    z-index: 2;
    background: #252636;
  }
  .pnl-table tbody td {
    padding: 8px 12px;
    text-align: right;
    border-bottom: 1px solid #2a2b35;
  }
  .pnl-table tbody td.row-label {
    text-align: left;
    font-weight: 600;
    color: #e1e2e8;
    position: sticky;
    left: 0;
    background: #1a1b23;
    z-index: 1;
  }
  .pnl-table tbody tr.summary-row td {
    font-weight: 700;
    border-top: 2px solid #3b6cf5;
    border-bottom: 2px solid #3b6cf5;
  }
  .pnl-table tbody tr.summary-row td.row-label {
    color: #6b8cff;
  }
  .pnl-table tbody tr:hover td {
    background: #1f2233;
  }
  .pnl-table tbody tr:hover td.row-label {
    background: #1f2233;
  }
  .pnl-table tbody tr.summary-row:hover td {
    background: #1c2040;
  }
  .pnl-table tbody tr.summary-row:hover td.row-label {
    background: #1c2040;
  }
  .pnl-table tbody tr.pct-row td {
    font-style: italic;
    color: #6a6b78;
  }
  .pnl-table tbody tr.pct-row:hover td {
    background: #1f2233;
  }
  .pnl-table tbody tr.pct-row:hover td.row-label {
    background: #1f2233;
  }
</style>
</head>
<body>

${entityName ? `<div class="entity-name">${entityName}</div>` : ''}
<h1>Financial Snapshot</h1>

<!-- Row 1: Revenue metrics -->
<div class="grid">
  <div class="card">
    <div class="card-header">Revenue<br>Current Mo.</div>
    <div class="card-body">
      <div class="kpi-value">${formatAbbrev(kpis.revenueCurrentMo)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Revenue 3<br>prior mos. avg.</div>
    <div class="card-body">
      <div class="kpi-value">${formatAbbrev(kpis.revenue3MoAvg)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">YTD<br>Revenue</div>
    <div class="card-body">
      <div class="kpi-value">${formatAbbrev(kpis.ytdRevenue)}</div>
      ${yoyRevHTML}
    </div>
  </div>

  <div class="card">
    <div class="card-header">PY to Date<br>Revenue</div>
    <div class="card-body">
      <div class="kpi-value">${kpis.pyToDateRevenue !== null ? formatAbbrev(kpis.pyToDateRevenue) : na}</div>
    </div>
  </div>
</div>

<!-- Row 2: Margin & net income -->
<div class="grid grid-5">
  <div class="card">
    <div class="card-header">Gross margin<br>Current Mo.</div>
    <div class="card-body">
      <div class="kpi-value">${formatPct(kpis.grossMarginCurrentMo)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Gross<br>margin YTD</div>
    <div class="card-body">
      <div class="kpi-value">${formatPct(kpis.grossMarginYTD)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Current Mo.<br>Net Income</div>
    <div class="card-body">
      <div class="kpi-value">${formatAbbrev(kpis.currentMoNetIncome)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Net Income<br>YTD</div>
    <div class="card-body">
      <div class="kpi-value">${formatAbbrev(kpis.netIncomeYTD)}</div>
      ${niYoyHTML}
    </div>
  </div>

  <div class="card">
    <div class="card-header">PY to Date<br>Net Income</div>
    <div class="card-body">
      <div class="kpi-value">${kpis.pyToDateNetIncome !== null ? formatAbbrev(kpis.pyToDateNetIncome) : na}</div>
    </div>
  </div>
</div>

${pnlTableHTML}

</body>
</html>`;
}
