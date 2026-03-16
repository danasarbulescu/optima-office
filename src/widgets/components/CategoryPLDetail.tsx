import React from 'react';
import { CategoryPLDetailData, CategoryPLDetailEntry } from '@/lib/types';

function fmtAmt(n: number): string {
  if (n === 0) return '–';
  const abs = Math.round(Math.abs(n)).toLocaleString('en-US');
  return n < 0 ? `(${abs})` : abs;
}

function fmtPct(ratio: number): string {
  if (ratio === 0) return '–';
  const s = (ratio * 100).toFixed(2) + '%';
  return ratio < 0 ? `(${(Math.abs(ratio) * 100).toFixed(2)}%)` : s;
}

function yoyRatio(curr: number, prior: number): number | null {
  if (prior === 0) return null;
  return (curr - prior) / Math.abs(prior);
}

// ── YOY mode helpers ──────────────────────────────────────────────────────────

interface YoyRowProps {
  label: string;
  curr: number;
  prior: number;
  incomeTotal: number;
  priorIncomeTotal: number;
  bold?: boolean;
  indent?: boolean;
  isGP?: boolean;
}

function YoyDataRow({ label, curr, prior, incomeTotal, priorIncomeTotal, bold, indent, isGP }: YoyRowProps) {
  const change = curr - prior;
  const changePct = yoyRatio(curr, prior);
  const currPct = incomeTotal !== 0 ? curr / incomeTotal : 0;
  const priorPct = priorIncomeTotal !== 0 ? prior / priorIncomeTotal : 0;

  const rowCls = `cpld-row ${isGP ? 'cpld-row-gp' : bold ? 'cpld-row-bold' : 'cpld-row-data'}`;

  return (
    <tr className={rowCls}>
      <td className={`cpld-td-account cpld-sticky${indent ? ' cpld-indent' : ''}`}>{label}</td>
      <td className={`cpld-td-num${curr < 0 ? ' cpld-neg' : ''}`}>{fmtAmt(curr)}</td>
      <td className="cpld-td-num">{fmtPct(currPct)}</td>
      <td className={`cpld-td-num${prior < 0 ? ' cpld-neg' : ''}`}>{fmtAmt(prior)}</td>
      <td className="cpld-td-num">{fmtPct(priorPct)}</td>
      <td className={`cpld-td-num${change < 0 ? ' cpld-neg' : ''}`}>{fmtAmt(change)}</td>
      <td className={`cpld-td-num${changePct !== null && changePct < 0 ? ' cpld-neg' : ''}`}>
        {changePct !== null ? fmtPct(changePct) : '–'}
      </td>
    </tr>
  );
}

// ── Range mode helpers ────────────────────────────────────────────────────────

interface RangeRowProps {
  label: string;
  periods: string[];
  getAmount: (p: string) => number;
  getIncomeTotal: (p: string) => number;
  bold?: boolean;
  indent?: boolean;
  isGP?: boolean;
}

function RangeDataRow({ label, periods, getAmount, getIncomeTotal, bold, indent, isGP }: RangeRowProps) {
  const rowCls = `cpld-row ${isGP ? 'cpld-row-gp' : bold ? 'cpld-row-bold' : 'cpld-row-data'}`;
  return (
    <tr className={rowCls}>
      <td className={`cpld-td-account cpld-sticky${indent ? ' cpld-indent' : ''}`}>{label}</td>
      {periods.map(p => {
        const val = getAmount(p);
        const inc = getIncomeTotal(p);
        const pct = inc !== 0 ? val / inc : 0;
        return (
          <React.Fragment key={p}>
            <td className={`cpld-td-num${val < 0 ? ' cpld-neg' : ''}`}>{fmtAmt(val)}</td>
            <td className="cpld-td-num">{fmtPct(pct)}</td>
          </React.Fragment>
        );
      })}
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CategoryPLDetail({ data }: { data: CategoryPLDetailData }) {
  const {
    categoryName, mode, periods, periodLabels,
    priorPeriods, priorPeriodLabels,
    incomeEntries, cogsEntries,
    incomeTotals, cogsTotals, gpTotals,
  } = data;

  const title = `${categoryName} Gross Profit`;

  // ── YOY mode ──────────────────────────────────────────────────────────────
  if (mode === 'yoy') {
    const cp = periods[0];
    const pp = priorPeriods![0];
    const cpLabel = periodLabels[0];
    const ppLabel = priorPeriodLabels![0];
    const incTotal = incomeTotals[cp] || 0;
    const priorIncTotal = incomeTotals[pp] || 0;

    return (
      <div className="cpld-container">
        <div className="cpld-title">{title}</div>
        <div className="cpld-scroll">
          <table className="cpld-table">
            <thead>
              <tr className="cpld-header-row1">
                <th className="cpld-th cpld-th-account cpld-sticky">Month Name</th>
                <th className="cpld-th cpld-th-span" colSpan={2}>{cpLabel}</th>
                <th className="cpld-th cpld-th-span" colSpan={2}>{ppLabel}</th>
                <th className="cpld-th cpld-th-span" colSpan={2}></th>
              </tr>
              <tr className="cpld-header-row2">
                <th className="cpld-th cpld-th-account cpld-sticky">Account Type</th>
                <th className="cpld-th cpld-th-num">Curr. Month</th>
                <th className="cpld-th cpld-th-num">% of Income</th>
                <th className="cpld-th cpld-th-num">YOY Amt</th>
                <th className="cpld-th cpld-th-num">% of Income</th>
                <th className="cpld-th cpld-th-num">YOY Change</th>
                <th className="cpld-th cpld-th-num">YOY Var%</th>
              </tr>
            </thead>
            <tbody>
              {/* Income section header */}
              <tr className="cpld-row cpld-row-section">
                <td className="cpld-td-account cpld-sticky" colSpan={7}>Income</td>
              </tr>

              {/* Income sub-accounts */}
              {incomeEntries.map(e => (
                <YoyDataRow
                  key={e.code ?? e.name}
                  label={e.code ? `${e.code} ${e.name}` : e.name}
                  curr={e.amounts[cp] || 0}
                  prior={e.amounts[pp] || 0}
                  incomeTotal={incTotal}
                  priorIncomeTotal={priorIncTotal}
                  indent
                />
              ))}

              {/* Income total */}
              <YoyDataRow
                label="Income"
                curr={incTotal}
                prior={priorIncTotal}
                incomeTotal={incTotal}
                priorIncomeTotal={priorIncTotal}
                bold
              />

              {/* COGS section header */}
              <tr className="cpld-row cpld-row-section">
                <td className="cpld-td-account cpld-sticky" colSpan={7}>Cost of Goods Sold</td>
              </tr>

              {/* COGS sub-accounts */}
              {cogsEntries.map(e => (
                <YoyDataRow
                  key={e.code ?? e.name}
                  label={e.code ? `${e.code} ${e.name}` : e.name}
                  curr={e.amounts[cp] || 0}
                  prior={e.amounts[pp] || 0}
                  incomeTotal={incTotal}
                  priorIncomeTotal={priorIncTotal}
                  indent
                />
              ))}

              {/* COGS total */}
              <YoyDataRow
                label="Cost of Goods Sold"
                curr={cogsTotals[cp] || 0}
                prior={cogsTotals[pp] || 0}
                incomeTotal={incTotal}
                priorIncomeTotal={priorIncTotal}
                bold
              />

              {/* Gross Profit */}
              <YoyDataRow
                label="Gross Profit"
                curr={gpTotals[cp] || 0}
                prior={gpTotals[pp] || 0}
                incomeTotal={incTotal}
                priorIncomeTotal={priorIncTotal}
                isGP
              />
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Range mode ─────────────────────────────────────────────────────────────
  const colCount = 1 + periods.length * 2;

  return (
    <div className="cpld-container">
      <div className="cpld-title">{title}</div>
      <div className="cpld-scroll">
        <table className="cpld-table">
          <thead>
            <tr className="cpld-header-row2">
              <th className="cpld-th cpld-th-account cpld-sticky">Account Type</th>
              {periodLabels.map((label, i) => (
                <React.Fragment key={periods[i]}>
                  <th className="cpld-th cpld-th-num">{label}</th>
                  <th className="cpld-th cpld-th-num">% Inc</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Income section */}
            <tr className="cpld-row cpld-row-section">
              <td className="cpld-td-account cpld-sticky" colSpan={colCount}>Income</td>
            </tr>
            {incomeEntries.map(e => (
              <RangeDataRow
                key={e.code ?? e.name}
                label={e.code ? `${e.code} ${e.name}` : e.name}
                periods={periods}
                getAmount={p => e.amounts[p] || 0}
                getIncomeTotal={p => incomeTotals[p] || 0}
                indent
              />
            ))}
            <RangeDataRow
              label="Income"
              periods={periods}
              getAmount={p => incomeTotals[p] || 0}
              getIncomeTotal={p => incomeTotals[p] || 0}
              bold
            />

            {/* COGS section */}
            <tr className="cpld-row cpld-row-section">
              <td className="cpld-td-account cpld-sticky" colSpan={colCount}>Cost of Goods Sold</td>
            </tr>
            {cogsEntries.map(e => (
              <RangeDataRow
                key={e.code ?? e.name}
                label={e.code ? `${e.code} ${e.name}` : e.name}
                periods={periods}
                getAmount={p => e.amounts[p] || 0}
                getIncomeTotal={p => incomeTotals[p] || 0}
                indent
              />
            ))}
            <RangeDataRow
              label="Cost of Goods Sold"
              periods={periods}
              getAmount={p => cogsTotals[p] || 0}
              getIncomeTotal={p => incomeTotals[p] || 0}
              bold
            />

            {/* Gross Profit */}
            <RangeDataRow
              label="Gross Profit"
              periods={periods}
              getAmount={p => gpTotals[p] || 0}
              getIncomeTotal={p => incomeTotals[p] || 0}
              isGP
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}
