import { RollingIncomeStatementData, RollingPLRow } from '@/lib/types';

function formatAmt(n: number): string {
  if (n === 0) return '-';
  const abs = Math.round(Math.abs(n)).toLocaleString('en-US');
  return n < 0 ? `(${abs})` : abs;
}

function formatPct(n: number): string {
  if (n === 0) return '-';
  return `${(n * 100).toFixed(1)}%`;
}

function isTotalRow(row: RollingPLRow): boolean {
  return row.rowType === 'Summary' && (row.rowId === null || row.rowId === '');
}

function isSubtotalRow(row: RollingPLRow): boolean {
  return row.rowType === 'Summary' && row.rowId !== null && row.rowId !== '';
}

function rowClass(row: RollingPLRow): string {
  if (row.rowType === 'Section') return 'ris-row ris-row-section';
  if (row.rowType === 'GpPercent') return 'ris-row ris-row-gp-pct';
  if (row.rowType === 'NopPercent') return 'ris-row ris-row-nop-pct';
  if (row.rowType === 'NiPercent')  return 'ris-row ris-row-ni-pct';
  if (isTotalRow(row)) return 'ris-row ris-row-total';
  if (isSubtotalRow(row)) return 'ris-row ris-row-subtotal';
  return 'ris-row ris-row-data';
}

const PCT_TYPES = new Set(['GpPercent', 'NopPercent', 'NiPercent']);

export default function RollingIncomeStatement({ data }: { data: RollingIncomeStatementData }) {
  const { months, monthLabels, rows } = data;

  return (
    <div className="ris-container">
      <div className="ris-scroll">
        <table className="ris-table">
          <thead>
            <tr className="ris-header-row">
              <th className="ris-th ris-th-account ris-sticky">Account Type</th>
              {monthLabels.map((label, i) => (
                <th key={months[i]} className="ris-th ris-th-month">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isSection = row.rowType === 'Section';
              const isPct = PCT_TYPES.has(row.rowType);
              return (
                <tr key={`${row.rowGroup}-${row.rowType}-${row.account}-${idx}`} className={rowClass(row)}>
                  <td className={`ris-td-account ris-sticky${row.rowType === 'Data' ? ' ris-indent' : ''}`}>
                    {row.account}
                  </td>
                  {months.map(m => {
                    if (isSection) return <td key={m} className="ris-td-num" />;
                    const val = row.periods[m] || 0;
                    if (isPct) {
                      return <td key={m} className="ris-td-num">{formatPct(val)}</td>;
                    }
                    return (
                      <td key={m} className={`ris-td-num${val < 0 ? ' ris-neg' : ''}`}>
                        {formatAmt(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
