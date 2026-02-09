import { PnLByMonth, PnLMonthEntry } from '@/lib/types';
import { formatAbbrev, formatPct } from '@/lib/format';

const ROW_DEFS: [string, keyof Omit<PnLMonthEntry, 'label'>, boolean | 'pct'][] = [
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

export default function PnlTable({ pnl }: { pnl: PnLByMonth }) {
  return (
    <div className="pnl-section">
      <h2>P&amp;L by Month</h2>
      <div className="table-scroll">
        <table className="pnl-table">
          <thead>
            <tr>
              <th className="row-label"></th>
              {pnl.months.map(m => <th key={m.label}>{m.label}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {ROW_DEFS.map(([label, key, rowType]) => {
              if (rowType === 'pct') {
                return (
                  <tr key={label} className="pct-row">
                    <td className="row-label">{label}</td>
                    {pnl.months.map(m => {
                      const pct = m.revenue !== 0 ? (m[key] / m.revenue) * 100 : 0;
                      return <td key={m.label}>{formatPct(pct)}</td>;
                    })}
                    <td>{formatPct(pnl.totals.revenue !== 0 ? (pnl.totals[key] / pnl.totals.revenue) * 100 : 0)}</td>
                  </tr>
                );
              }
              return (
                <tr key={label} className={rowType ? 'summary-row' : undefined}>
                  <td className="row-label">{label}</td>
                  {pnl.months.map(m => <td key={m.label}>{formatAbbrev(m[key])}</td>)}
                  <td>{formatAbbrev(pnl.totals[key])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
