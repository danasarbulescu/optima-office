export interface WidgetType {
  id: string;
  category: 'KPI Card' | 'Table' | 'Chart';
  component: 'KpiCard' | 'PnlTable' | 'TrendChart' | 'BudgetVsActual' | 'SummaryBva' | 'ComparativeSnapshot' | 'RollingIncomeStatement' | 'CategoryPL' | 'CategoryPLDetail';
}
