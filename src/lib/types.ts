export interface CDataPLRow {
  account: string;
  RowGroup: string;
  RowType: string;
  RowId: string | null;
  [key: string]: any;
}

export type GroupValues = Map<string, number[]>;

export interface PnLMonthEntry {
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netOperatingIncome: number;
  otherExpenses: number;
  netOtherIncome: number;
  netIncome: number;
}

export interface PnLByMonth {
  months: PnLMonthEntry[];
  totals: Omit<PnLMonthEntry, 'label'>;
}

export interface TrendDataPoint {
  month: string;
  expenses: number;
  avg13: number | null;
}

export interface KPIs {
  revenueCurrentMo: number;
  revenue3MoAvg: number;
  ytdRevenue: number;
  pyToDateRevenue: number | null;
  yoyRevenueVariance: number | null;
  yoyRevenueVariancePct: number | null;
  grossMarginCurrentMo: number;
  grossMarginYTD: number;
  currentMoNetIncome: number;
  netIncomeYTD: number;
  pyToDateNetIncome: number | null;
  netIncomeYoyVariance: number | null;
}
