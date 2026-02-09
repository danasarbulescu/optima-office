export interface WidgetType {
  id: string;
  name: string;
  category: 'KPI Card' | 'Table' | 'Chart';
  component: 'KpiCard' | 'PnlTable' | 'TrendChart';
}
