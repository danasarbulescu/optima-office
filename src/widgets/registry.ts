import { WidgetType } from './types';

export const WIDGET_TYPES: WidgetType[] = [
  // KPI Cards
  { id: 'kpi-revenue-current-mo',    name: 'Revenue Current Month',    category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-revenue-3mo-avg',       name: 'Revenue 3 Prior Mos Avg',  category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-ytd-revenue',           name: 'YTD Revenue',              category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-py-revenue',            name: 'PY to Date Revenue',       category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-gross-margin-current-mo', name: 'Gross Margin Current Mo', category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-gross-margin-ytd',      name: 'Gross Margin YTD',         category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-net-income-current-mo', name: 'Current Mo Net Income',    category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-net-income-ytd',        name: 'Net Income YTD',           category: 'KPI Card', component: 'KpiCard' },
  { id: 'kpi-py-net-income',         name: 'PY to Date Net Income',    category: 'KPI Card', component: 'KpiCard' },

  // Table
  { id: 'pnl-table-13mo', name: 'P&L by Month (13mo)', category: 'Table', component: 'PnlTable' },

  // Chart
  { id: 'trend-chart-expenses', name: 'Operating Expenses Trend', category: 'Chart', component: 'TrendChart' },
];

export function getWidgetType(id: string): WidgetType | undefined {
  return WIDGET_TYPES.find(w => w.id === id);
}
