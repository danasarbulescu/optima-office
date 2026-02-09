export type DataSourceType = 'financial-snapshot' | 'expense-trend';

export interface WidgetType {
  id: string;
  name: string;
  category: 'KPI Card' | 'Table' | 'Chart';
  dataSourceType: DataSourceType;
  component: 'KpiCard' | 'PnlTable' | 'TrendChart';
}
