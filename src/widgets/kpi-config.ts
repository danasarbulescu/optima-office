import { KPIs } from '@/lib/types';

export interface KpiWidgetConfig {
  headerLine1: string;
  headerLine2: string;
  field: keyof KPIs;
  format: 'currency' | 'percent';
  varianceField?: keyof KPIs;
  variancePctField?: keyof KPIs;
  varianceLabel?: string;
  nullable?: boolean;
}

export const KPI_CONFIGS: Record<string, KpiWidgetConfig> = {
  'kpi-revenue-current-mo': {
    headerLine1: 'Revenue',
    headerLine2: 'Current Mo.',
    field: 'revenueCurrentMo',
    format: 'currency',
  },
  'kpi-revenue-3mo-avg': {
    headerLine1: 'Revenue 3',
    headerLine2: 'prior mos. avg.',
    field: 'revenue3MoAvg',
    format: 'currency',
  },
  'kpi-ytd-revenue': {
    headerLine1: 'YTD',
    headerLine2: 'Revenue',
    field: 'ytdRevenue',
    format: 'currency',
    varianceField: 'yoyRevenueVariance',
    variancePctField: 'yoyRevenueVariancePct',
    varianceLabel: 'YOY Variance',
  },
  'kpi-py-revenue': {
    headerLine1: 'PY to Date',
    headerLine2: 'Revenue',
    field: 'pyToDateRevenue',
    format: 'currency',
    nullable: true,
  },
  'kpi-gross-margin-current-mo': {
    headerLine1: 'Gross margin',
    headerLine2: 'Current Mo.',
    field: 'grossMarginCurrentMo',
    format: 'percent',
  },
  'kpi-gross-margin-ytd': {
    headerLine1: 'Gross',
    headerLine2: 'margin YTD',
    field: 'grossMarginYTD',
    format: 'percent',
  },
  'kpi-net-income-current-mo': {
    headerLine1: 'Current Mo.',
    headerLine2: 'Net Income',
    field: 'currentMoNetIncome',
    format: 'currency',
  },
  'kpi-net-income-ytd': {
    headerLine1: 'Net Income',
    headerLine2: 'YTD',
    field: 'netIncomeYTD',
    format: 'currency',
    varianceField: 'netIncomeYoyVariance',
  },
  'kpi-py-net-income': {
    headerLine1: 'PY to Date',
    headerLine2: 'Net Income',
    field: 'pyToDateNetIncome',
    format: 'currency',
    nullable: true,
  },
};
