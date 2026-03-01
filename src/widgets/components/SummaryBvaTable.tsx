'use client';

import { useState, useMemo, Fragment } from 'react';
import { SummaryBvaData } from '@/lib/types';
import '@/widgets/widgets.css';

interface Props {
  data: SummaryBvaData;
  month: string;
}

function formatNum(v: number): string {
  return Math.round(v).toLocaleString();
}

function formatPct(value: number): string {
  return value.toFixed(1) + '%';
}

function varianceClass(v: number): string {
  if (v > 0) return 'bva-pos';
  if (v < 0) return 'bva-neg';
  return '';
}

const COLS_PER_CLASS = 5; // Actual, Budget, Forecast, Var $, Var %
const TOTAL_KEY = '__total__';

export default function SummaryBvaTable({ data, month }: Props) {
  const [selectedMonth] = useState(month);

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

  // Class visibility toggles
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(() => {
    const all = new Set(data.classes.map(c => c.classId));
    all.add(TOTAL_KEY);
    return all;
  });
  const toggleGroup = (key: string) => {
    setVisibleGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const showClass = (classId: string) => visibleGroups.has(classId);
  const showTotal = visibleGroups.has(TOTAL_KEY);

  const effectiveDaysInMonth = data.daysInMonth;
  const classes = data.classes;

  return (
    <div className="bva-container">
      <h3 className="sbva-title">Summary Budget to Actuals</h3>
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
        <div className="bva-col-toggles">
          {classes.map(cls => (
            <label key={cls.classId} className="bva-col-toggle">
              <input
                type="checkbox"
                checked={visibleGroups.has(cls.classId)}
                onChange={() => toggleGroup(cls.classId)}
              />
              {cls.className}
            </label>
          ))}
          <label className="bva-col-toggle">
            <input
              type="checkbox"
              checked={showTotal}
              onChange={() => toggleGroup(TOTAL_KEY)}
            />
            Total
          </label>
        </div>
      </div>

      <div className="bva-scroll-wrapper">
        <table className="bva-table">
          <colgroup>
            <col className="bva-col-name" />
            {classes.flatMap(cls => showClass(cls.classId) ? [
              <col key={cls.classId + '-actual'}   className="bva-col-num" />,
              <col key={cls.classId + '-budget'}   className="bva-col-num" />,
              <col key={cls.classId + '-forecast'} className="bva-col-num" />,
              <col key={cls.classId + '-var$'}     className="bva-col-num" />,
              <col key={cls.classId + '-varpct'}   className="bva-col-num" />,
            ] : [])}
            {showTotal && <>
              <col className="bva-col-num" />
              <col className="bva-col-num" />
              <col className="bva-col-num" />
              <col className="bva-col-num" />
              <col className="bva-col-num" />
            </>}
          </colgroup>

          <thead>
            {/* Row 1: class group headers */}
            <tr className="bva-header-group">
              <th className="bva-th-name bva-sticky" rowSpan={2}>Metric</th>
              {classes.map(cls => showClass(cls.classId) && (
                <th key={cls.classId} colSpan={COLS_PER_CLASS} className="bva-th-class">
                  {cls.className}
                </th>
              ))}
              {showTotal && <th colSpan={COLS_PER_CLASS} className="bva-th-class bva-th-total">Total</th>}
            </tr>
            {/* Row 2: sub-column headers */}
            <tr className="bva-header-sub">
              {classes.flatMap(cls => showClass(cls.classId) ? [
                <th key={cls.classId + '-a'} className="bva-th-sub">Actual</th>,
                <th key={cls.classId + '-b'} className="bva-th-sub">Budget</th>,
                <th key={cls.classId + '-f'} className="bva-th-sub">Forecast</th>,
                <th key={cls.classId + '-v'} className="bva-th-sub">Var $</th>,
                <th key={cls.classId + '-p'} className="bva-th-sub">Var %</th>,
              ] : [])}
              {showTotal && <>
                <th className="bva-th-sub">Actual</th>
                <th className="bva-th-sub">Budget</th>
                <th className="bva-th-sub">Forecast</th>
                <th className="bva-th-sub">Var $</th>
                <th className="bva-th-sub">Var %</th>
              </>}
            </tr>
          </thead>

          <tbody>
            {data.rows.map((row, i) => {
              // Per-class computed values
              const classValues = classes.map(cls => {
                const { actual, budget } = row.byClass[cls.classId] ?? { actual: 0, budget: 0 };
                const forecast = asOfDay > 0 ? (actual / asOfDay) * effectiveDaysInMonth : 0;
                const varAmt = actual - budget;
                const varPct = budget !== 0 ? (varAmt / Math.abs(budget)) * 100 : null;
                return { actual, budget, forecast, varAmt, varPct };
              });

              // Total column
              const totalActual   = row.total.actual;
              const totalBudget   = row.total.budget;
              const totalForecast = asOfDay > 0 ? (totalActual / asOfDay) * effectiveDaysInMonth : 0;
              const totalVarAmt   = totalActual - totalBudget;
              const totalVarPct   = totalBudget !== 0 ? (totalVarAmt / Math.abs(totalBudget)) * 100 : null;

              return (
                <tr key={i} className="bva-row bva-row-bold">
                  <td className="bva-td-name bva-sticky">{row.label}</td>

                  {classValues.map((cv, ci) => showClass(classes[ci].classId) && (
                    <Fragment key={ci}>
                      <td className="bva-td-num">{formatNum(cv.actual)}</td>
                      <td className="bva-td-num">{formatNum(cv.budget)}</td>
                      <td className="bva-td-num">{formatNum(cv.forecast)}</td>
                      <td className={`bva-td-num ${varianceClass(cv.varAmt)}`}>
                        {formatNum(cv.varAmt)}
                      </td>
                      <td className={`bva-td-num ${cv.varPct !== null ? varianceClass(cv.varPct) : ''}`}>
                        {cv.varPct !== null ? formatPct(cv.varPct) : ''}
                      </td>
                    </Fragment>
                  ))}

                  {/* Total */}
                  {showTotal && <>
                    <td className="bva-td-num bva-td-total">{formatNum(totalActual)}</td>
                    <td className="bva-td-num bva-td-total">{formatNum(totalBudget)}</td>
                    <td className="bva-td-num bva-td-total">{formatNum(totalForecast)}</td>
                    <td className={`bva-td-num bva-td-total ${varianceClass(totalVarAmt)}`}>
                      {formatNum(totalVarAmt)}
                    </td>
                    <td className={`bva-td-num bva-td-total ${totalVarPct !== null ? varianceClass(totalVarPct) : ''}`}>
                      {totalVarPct !== null ? formatPct(totalVarPct) : ''}
                    </td>
                  </>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
