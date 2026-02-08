import { FinancialRow } from './models/financial';
import { KPIs, PnLMonthEntry, PnLByMonth, TrendDataPoint } from './types';

export type GroupValues = Map<string, number[]>;

export function buildGroupValues(rows: FinancialRow[], year: number): GroupValues {
  const map: GroupValues = new Map();

  for (const row of rows) {
    const values: number[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      values.push(row.periods[key] || 0);
    }
    // Index 12 = computed annual total
    values.push(values.reduce((a, b) => a + b, 0));
    map.set(row.category, values);
  }

  return map;
}

export function sumRange(values: number[], from: number, to: number): number {
  let total = 0;
  for (let i = from; i <= to && i < values.length; i++) {
    total += values[i];
  }
  return total;
}

export function computeKPIs(
  curGroups: GroupValues,
  pyGroups: GroupValues | null,
  monthIdx: number,
): KPIs {
  const income = curGroups.get('Income') || [];
  const grossProfit = curGroups.get('GrossProfit') || [];
  const netIncome = curGroups.get('NetIncome') || [];

  // Current month values
  const revenueCurrentMo = monthIdx >= 0 ? (income[monthIdx] || 0) : 0;
  const gpCurrentMo = monthIdx >= 0 ? (grossProfit[monthIdx] || 0) : 0;
  const currentMoNetIncome = monthIdx >= 0 ? (netIncome[monthIdx] || 0) : 0;

  // Revenue 3 prior months average (rolling across year boundary)
  const pyIncome = pyGroups?.get('Income') || [];
  let rev3Sum = 0;
  let rev3Count = 0;
  for (let i = monthIdx - 3; i < monthIdx; i++) {
    if (i >= 0) {
      rev3Sum += income[i] || 0;
      rev3Count++;
    } else if (pyIncome.length > 0) {
      rev3Sum += pyIncome[12 + i] || 0; // -1 -> 11 (Dec), -2 -> 10 (Nov), -3 -> 9 (Oct)
      rev3Count++;
    }
  }
  const revenue3MoAvg = rev3Count > 0 ? rev3Sum / rev3Count : 0;

  // YTD sums (Jan through selected month)
  const ytdRevenue = sumRange(income, 0, monthIdx);
  const ytdGP = sumRange(grossProfit, 0, monthIdx);
  const netIncomeYTD = sumRange(netIncome, 0, monthIdx);

  // Gross margins
  const grossMarginCurrentMo = revenueCurrentMo !== 0 ? (gpCurrentMo / revenueCurrentMo) * 100 : 0;
  const grossMarginYTD = ytdRevenue !== 0 ? (ytdGP / ytdRevenue) * 100 : 0;

  // Prior year
  let pyToDateRevenue: number | null = null;
  let yoyRevenueVariance: number | null = null;
  let yoyRevenueVariancePct: number | null = null;
  let pyToDateNetIncome: number | null = null;
  let netIncomeYoyVariance: number | null = null;

  if (pyGroups) {
    const pyNetIncome = pyGroups.get('NetIncome') || [];

    pyToDateRevenue = sumRange(pyIncome, 0, monthIdx);
    pyToDateNetIncome = sumRange(pyNetIncome, 0, monthIdx);

    yoyRevenueVariance = ytdRevenue - pyToDateRevenue;
    yoyRevenueVariancePct = pyToDateRevenue !== 0
      ? (yoyRevenueVariance / pyToDateRevenue) * 100
      : null;
    netIncomeYoyVariance = netIncomeYTD - pyToDateNetIncome;
  }

  return {
    revenueCurrentMo,
    revenue3MoAvg,
    ytdRevenue,
    pyToDateRevenue,
    yoyRevenueVariance,
    yoyRevenueVariancePct,
    grossMarginCurrentMo,
    grossMarginYTD,
    currentMoNetIncome,
    netIncomeYTD,
    pyToDateNetIncome,
    netIncomeYoyVariance,
  };
}

export function build13MonthPnL(
  curGroups: GroupValues,
  pyGroups: GroupValues | null,
  selectedMonth: string,
): PnLByMonth {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [yearStr, moStr] = selectedMonth.split('-');
  const year = Number(yearStr);
  const moIdx = parseInt(moStr, 10) - 1;

  const groupKeys = [
    'Income', 'COGS', 'GrossProfit', 'Expenses',
    'NetOperatingIncome', 'OtherExpenses', 'NetOtherIncome', 'NetIncome',
  ] as const;

  const propNames: (keyof Omit<PnLMonthEntry, 'label'>)[] = [
    'revenue', 'cogs', 'grossProfit', 'expenses',
    'netOperatingIncome', 'otherExpenses', 'netOtherIncome', 'netIncome',
  ];

  function getValue(groupKey: string, monthNum: number, sourceYear: number): number {
    const groups = sourceYear === year ? curGroups : pyGroups;
    if (!groups) return 0;
    const arr = groups.get(groupKey);
    if (!arr) return 0;
    return arr[monthNum] || 0;
  }

  const months: PnLMonthEntry[] = [];

  // Phase 1: Prior year months from moIdx through Dec
  for (let m = moIdx; m <= 11; m++) {
    const label = `${monthNames[m]} ${String(year - 1).slice(2)}`;
    const entry: any = { label };
    for (let g = 0; g < groupKeys.length; g++) {
      entry[propNames[g]] = getValue(groupKeys[g], m, year - 1);
    }
    months.push(entry as PnLMonthEntry);
  }

  // Phase 2: Current year months from Jan through moIdx (inclusive)
  for (let m = 0; m <= moIdx; m++) {
    const label = `${monthNames[m]} ${String(year).slice(2)}`;
    const entry: any = { label };
    for (let g = 0; g < groupKeys.length; g++) {
      entry[propNames[g]] = getValue(groupKeys[g], m, year);
    }
    months.push(entry as PnLMonthEntry);
  }

  const totals: any = {};
  for (const prop of propNames) {
    totals[prop] = months.reduce((sum, mo) => sum + (mo as any)[prop], 0);
  }

  return { months, totals };
}

function subtractMonths(monthStr: string, n: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const total = y * 12 + (m - 1) - n;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, '0')}`;
}

export function buildExpensesTrend(
  rows: FinancialRow[],
  startMonth: string,
  endMonth: string,
): TrendDataPoint[] {
  // Build flat array from (startMonth - 12) through endMonth
  const extractionStart = subtractMonths(startMonth, 12);
  const [startY, startM] = extractionStart.split('-').map(Number);
  const [endY, endM] = endMonth.split('-').map(Number);

  // Find the Expenses row and read periods directly
  const expensesRow = rows.find(r => r.category === 'Expenses');

  const allMonths: { month: string; value: number }[] = [];
  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const value = expensesRow?.periods[key] || 0;
    allMonths.push({ month: key, value });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  // Compute rolling 13-month average and build result for requested range only
  const result: TrendDataPoint[] = [];
  for (let i = 0; i < allMonths.length; i++) {
    if (allMonths[i].month < startMonth) continue;
    const avg13 = i >= 12
      ? allMonths.slice(i - 12, i + 1).reduce((s, p) => s + p.value, 0) / 13
      : null;
    result.push({
      month: allMonths[i].month,
      expenses: allMonths[i].value,
      avg13,
    });
  }

  return result;
}
