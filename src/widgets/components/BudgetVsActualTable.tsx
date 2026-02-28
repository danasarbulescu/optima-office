'use client';

import { useState, useMemo, Fragment } from 'react';
import { BudgetVsActualData } from '@/lib/types';
import { formatAbbrev } from '@/lib/format';
import '@/widgets/widgets.css';

interface Props {
  data: BudgetVsActualData;
  month: string;
}

function formatPct(value: number): string {
  return value.toFixed(1) + '%';
}

function fmtCurrency(v: number): string {
  return formatAbbrev(v);
}

function varianceClass(v: number): string {
  if (v > 0) return 'bva-pos';
  if (v < 0) return 'bva-neg';
  return '';
}

export default function BudgetVsActualTable({ data, month }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(month);

  // Default asOfDay: today's day if we're in the selected month, else last day of month
  const defaultDay = useMemo(() => {
    const today = new Date();
    const [y, m] = selectedMonth.split('-').map(Number);
    if (today.getFullYear() === y && today.getMonth() + 1 === m) {
      return today.getDate();
    }
    return data.daysInMonth;
  }, [selectedMonth, data.daysInMonth]);

  const [asOfDay, setAsOfDay] = useState(defaultDay);

  // When month prop changes (parent refetch), reset asOfDay
  const effectiveDaysInMonth = data.daysInMonth;

  const classes = data.classes;

  return (
    <div className="bva-container">
      <div className="bva-controls">
        <label className="bva-label">
          As of Day:
          <input
            type="number"
            min={1}
            max={effectiveDaysInMonth}
            value={asOfDay}
            onChange={e => {
              const v = Math.max(1, Math.min(effectiveDaysInMonth, parseInt(e.target.value, 10) || 1));
              setAsOfDay(v);
            }}
            className="bva-day-input"
          />
          <span className="bva-day-hint">/ {effectiveDaysInMonth}</span>
        </label>
      </div>

      <div className="bva-scroll-wrapper">
        <table className="bva-table">
          <colgroup>
            <col className="bva-col-name" />
            {classes.map(cls => (
              <col key={cls.classId + '-actual'}   className="bva-col-num" />
            ))}
            {classes.map(cls => (
              <col key={cls.classId + '-budget'}   className="bva-col-num" />
            ))}
            {classes.map(cls => (
              <col key={cls.classId + '-forecast'} className="bva-col-num" />
            ))}
            {classes.map(cls => (
              <col key={cls.classId + '-var$'}     className="bva-col-num" />
            ))}
            {classes.map(cls => (
              <col key={cls.classId + '-varpct'}   className="bva-col-num" />
            ))}
            {/* Total group */}
            <col className="bva-col-num" />
            <col className="bva-col-num" />
            <col className="bva-col-num" />
            <col className="bva-col-num" />
            <col className="bva-col-num" />
          </colgroup>

          <thead>
            {/* Row 1: class group headers */}
            <tr className="bva-header-group">
              <th className="bva-th-name bva-sticky" rowSpan={2}>Account</th>
              {classes.map(cls => (
                <th key={cls.classId} colSpan={5} className="bva-th-class">
                  {cls.className}
                </th>
              ))}
              <th colSpan={5} className="bva-th-class bva-th-total">Total</th>
            </tr>
            {/* Row 2: sub-column headers */}
            <tr className="bva-header-sub">
              {classes.flatMap(cls => [
                <th key={cls.classId + '-a'} className="bva-th-sub">Actual</th>,
                <th key={cls.classId + '-b'} className="bva-th-sub">Budget</th>,
                <th key={cls.classId + '-f'} className="bva-th-sub">Forecast</th>,
                <th key={cls.classId + '-v'} className="bva-th-sub">Var $</th>,
                <th key={cls.classId + '-p'} className="bva-th-sub">Var %</th>,
              ])}
              <th className="bva-th-sub">Actual</th>
              <th className="bva-th-sub">Budget</th>
              <th className="bva-th-sub">Forecast</th>
              <th className="bva-th-sub">Var $</th>
              <th className="bva-th-sub">Var %</th>
            </tr>
          </thead>

          <tbody>
            {data.rows.map((row, i) => {
              const isBold = row.rowType === 'subtotal' || row.rowType === 'section';
              const isSection = row.rowType === 'section';
              const paddingLeft = row.depth * 16;

              // Per-class computed values
              const classValues = classes.map(cls => {
                const { actual, budget } = row.byClass[cls.classId] ?? { actual: 0, budget: 0 };
                const forecast = asOfDay > 0 ? (actual / asOfDay) * effectiveDaysInMonth : 0;
                const varAmt = budget - forecast;
                const varPct = budget !== 0 ? (varAmt / Math.abs(budget)) * 100 : null;
                return { actual, budget, forecast, varAmt, varPct };
              });

              // Total column
              const totalActual   = row.total.actual;
              const totalBudget   = row.total.budget;
              const totalForecast = asOfDay > 0 ? (totalActual / asOfDay) * effectiveDaysInMonth : 0;
              const totalVarAmt   = totalBudget - totalForecast;
              const totalVarPct   = totalBudget !== 0 ? (totalVarAmt / Math.abs(totalBudget)) * 100 : null;

              return (
                <tr
                  key={i}
                  className={[
                    'bva-row',
                    isBold ? 'bva-row-bold' : '',
                    isSection ? 'bva-row-section' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <td
                    className="bva-td-name bva-sticky"
                    style={{ paddingLeft: `${8 + paddingLeft}px` }}
                  >
                    {row.accountName}
                  </td>

                  {classValues.map((cv, ci) => (
                    <Fragment key={ci}>
                      <td className="bva-td-num">{isSection ? '' : fmtCurrency(cv.actual)}</td>
                      <td className="bva-td-num">{isSection ? '' : fmtCurrency(cv.budget)}</td>
                      <td className="bva-td-num">{isSection ? '' : fmtCurrency(cv.forecast)}</td>
                      <td className={`bva-td-num ${isSection ? '' : varianceClass(cv.varAmt)}`}>
                        {isSection ? '' : fmtCurrency(cv.varAmt)}
                      </td>
                      <td className={`bva-td-num ${isSection ? '' : (cv.varPct !== null ? varianceClass(cv.varPct) : '')}`}>
                        {isSection || cv.varPct === null ? '' : formatPct(cv.varPct)}
                      </td>
                    </Fragment>
                  ))}

                  {/* Total */}
                  <td className="bva-td-num bva-td-total">{isSection ? '' : fmtCurrency(totalActual)}</td>
                  <td className="bva-td-num bva-td-total">{isSection ? '' : fmtCurrency(totalBudget)}</td>
                  <td className="bva-td-num bva-td-total">{isSection ? '' : fmtCurrency(totalForecast)}</td>
                  <td className={`bva-td-num bva-td-total ${isSection ? '' : varianceClass(totalVarAmt)}`}>
                    {isSection ? '' : fmtCurrency(totalVarAmt)}
                  </td>
                  <td className={`bva-td-num bva-td-total ${isSection ? '' : (totalVarPct !== null ? varianceClass(totalVarPct) : '')}`}>
                    {isSection || totalVarPct === null ? '' : formatPct(totalVarPct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
