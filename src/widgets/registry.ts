import { WidgetType } from './types';

export const WIDGET_TYPES: WidgetType[] = [
  // KPI Cards
  { id: 'kpi-revenue-current-mo',      category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-revenue-3mo-avg',         category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-ytd-revenue',             category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-py-revenue',              category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-gross-margin-current-mo', category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-gross-margin-ytd',        category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-net-income-current-mo',   category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-net-income-ytd',          category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-py-net-income',           category: 'KPI Card', component: 'KpiCard' },

  // Table
  { id: 'pnl-table-13mo', category: 'Table', component: 'PnlTable' },

  // Chart
  { id: 'trend-chart-expenses', category: 'Chart', component: 'TrendChart' },

  // Budget vs. Actual
  { id: 'budget-vs-actual', category: 'Table', component: 'BudgetVsActual' },

  // Summary Budget vs. Actual (operational metrics)
  { id: 'summary-bva', category: 'Table', component: 'SummaryBva' },

  // Comparative Snapshot P&L
  { id: 'comparative-snapshot', category: 'Table', component: 'ComparativeSnapshot' },

  // Rolling 13-Month Income Statement (account-level detail)
  { id: 'rolling-income-statement', category: 'Table', component: 'RollingIncomeStatement' },
];

/** Default display name for widget types without a DynamoDB override */
export function defaultWidgetName(id: string): string {
  return `widget-${id}`;
}

export function getWidgetType(id: string): WidgetType | undefined {
  return WIDGET_TYPES.find(w => w.id === id);
}
