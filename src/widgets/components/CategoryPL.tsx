import { CategoryPLData, CategoryPLRow } from '@/lib/types';

function formatAmt(n: number): string {
  if (n === 0) return '-';
  const abs = Math.round(Math.abs(n)).toLocaleString('en-US');
  return n < 0 ? `(${abs})` : abs;
}

function formatPct(n: number): string {
  if (n === 0) return '-';
  return `${(n * 100).toFixed(1)}%`;
}

function rowClass(row: CategoryPLRow): string {
  if (row.isPct)  return 'cpl-row cpl-row-pct';
  if (row.isBold) return 'cpl-row cpl-row-total';
  return 'cpl-row cpl-row-data';
}

export default function CategoryPL({ data }: { data: CategoryPLData }) {
  const { months, monthLabels, groups } = data;

  if (groups.length === 0) {
    return (
      <div className="cpl-container">
        <div className="cpl-empty">No account categories configured for the selected entities.</div>
      </div>
    );
  }

  return (
    <div className="cpl-container">
      <div className="cpl-scroll">
        <table className="cpl-table">
          <thead>
            <tr className="cpl-header-row">
              <th className="cpl-th cpl-th-account cpl-sticky">Account</th>
              {monthLabels.map((label, i) => (
                <th key={months[i]} className="cpl-th cpl-th-month">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <>
                {/* Category section header */}
                <tr key={`section-${group.name}`} className="cpl-row cpl-row-section">
                  <td className="cpl-td-account cpl-sticky" colSpan={1}>{group.name}</td>
                  {months.map(m => <td key={m} className="cpl-td-num" />)}
                </tr>

                {/* Revenue, COGS, Gross Profit, GP% rows */}
                {group.rows.map(row => (
                  <tr key={`${group.name}-${row.label}`} className={rowClass(row)}>
                    <td className={`cpl-td-account cpl-sticky${!row.isBold ? ' cpl-indent' : ''}`}>
                      {row.label}
                    </td>
                    {months.map(m => {
                      const val = row.values[m] || 0;
                      if (row.isPct) {
                        return <td key={m} className="cpl-td-num">{formatPct(val)}</td>;
                      }
                      return (
                        <td key={m} className={`cpl-td-num${val < 0 ? ' cpl-neg' : ''}`}>
                          {formatAmt(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
