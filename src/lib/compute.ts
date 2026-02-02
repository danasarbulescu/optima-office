import { CDataPLRow, GroupValues, KPIs, PnLMonthEntry, PnLByMonth } from './types';

export function buildGroupValues(rows: CDataPLRow[], year: number): GroupValues {
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const map: GroupValues = new Map();

  for (const row of rows) {
    const values: number[] = [];
    for (let m = 0; m < 12; m++) {
      const colName = `${monthNames[m]}_${year}`;
      values.push(parseFloat(row[colName]) || 0);
    }
    // Index 12 = computed annual total
    values.push(values.reduce((a, b) => a + b, 0));
    map.set(row.RowGroup, values);
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

  // Revenue 3 prior months average
  let rev3Sum = 0;
  let rev3Count = 0;
  for (let i = monthIdx - 3; i < monthIdx; i++) {
    if (i >= 0 && i < income.length) {
      rev3Sum += income[i];
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
    const pyIncome = pyGroups.get('Income') || [];
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
