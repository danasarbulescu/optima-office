import { ComparativeSnapshotData, ComparativeSnapshotRow } from '@/lib/types';

function formatAmount(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function formatChg(n: number | null): string {
  if (n === null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function chgClass(n: number | null): string {
  if (n === null) return 'csnap-neutral';
  return n >= 0 ? 'csnap-pos' : 'csnap-neg';
}

function AmountCell({ row, value }: { row: ComparativeSnapshotRow; value: number }) {
  if (row.isPct) {
    return <td className="csnap-num">{formatPct(value)}</td>;
  }
  return <td className="csnap-num">{formatAmount(value)}</td>;
}

export default function ComparativeSnapshot({ data }: { data: ComparativeSnapshotData }) {
  const { rows, priorYearQLabel, currentQLabel, priorYearMonthLabel, currentMonthLabel, ytdPriorLabel, ytdCurrentLabel } = data;

  return (
    <div className="csnap-section">
      <h2 className="csnap-title">Snapshot P&amp;L</h2>
      <div className="csnap-scroll">
        <table className="csnap-table">
          <thead>
            <tr className="csnap-header">
              <th className="csnap-th-label"></th>
              <th className="csnap-th-num">{priorYearQLabel}</th>
              <th className="csnap-th-num">{currentQLabel}</th>
              <th className="csnap-th-chg">Chg. QoQ</th>
              <th className="csnap-th-num csnap-th-group">{priorYearMonthLabel}</th>
              <th className="csnap-th-num">{currentMonthLabel}</th>
              <th className="csnap-th-chg">Chg. MoM</th>
              <th className="csnap-th-num csnap-th-group">{ytdPriorLabel}</th>
              <th className="csnap-th-num">{ytdCurrentLabel}</th>
              <th className="csnap-th-chg">Chg. YTD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const trClass = row.isBold
                ? 'csnap-row csnap-row-bold'
                : row.isPct
                  ? 'csnap-row csnap-row-pct'
                  : 'csnap-row';
              return (
                <tr key={row.label} className={trClass}>
                  <td className="csnap-td-label">{row.label}</td>
                  <AmountCell row={row} value={row.priorYearQ} />
                  <AmountCell row={row} value={row.currentQ} />
                  <td className={`csnap-num ${chgClass(row.chgQoQ)}`}>{formatChg(row.chgQoQ)}</td>
                  <AmountCell row={row} value={row.priorYearMonth} />
                  <AmountCell row={row} value={row.currentMonth} />
                  <td className={`csnap-num ${chgClass(row.chgMoM)}`}>{formatChg(row.chgMoM)}</td>
                  <AmountCell row={row} value={row.ytdPrior} />
                  <AmountCell row={row} value={row.ytdCurrent} />
                  <td className={`csnap-num ${chgClass(row.chgYTD)}`}>{formatChg(row.chgYTD)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
