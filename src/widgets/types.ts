export interface WidgetType {
  id: string;
  category: 'KPI Card' | 'Table' | 'Chart';
  component: 'KpiCard' | 'PnlTable' | 'TrendChart';
}
