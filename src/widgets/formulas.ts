/**
 * Human-readable formula descriptions for each widget type.
 * Derived from the compute logic in src/lib/compute.ts.
 */

export interface WidgetFormula {
  /** Primary formula expression */
  formula: string;
  /** Data source categories used */
  sources: string[];
  /** Variance formula, if any */
  variance?: string;
}

export const WIDGET_FORMULAS: Record<string, WidgetFormula> = {
  'kpi-revenue-current-mo': {
    formula: 'Income[month]',
    sources: ['Income'],
  },
  'kpi-revenue-3mo-avg': {
    formula: '( Income[month−1] + Income[month−2] + Income[month−3] ) / 3',
    sources: ['Income'],
  },
  'kpi-ytd-revenue': {
    formula: 'Σ Income[ Jan … month ]',
    sources: ['Income'],
    variance: 'YTD Revenue − PY to Date Revenue',
  },
  'kpi-py-revenue': {
    formula: 'Σ PriorYear.Income[ Jan … month ]',
    sources: ['Income (prior year)'],
  },
  'kpi-gross-margin-current-mo': {
    formula: 'GrossProfit[month] / Income[month] × 100',
    sources: ['GrossProfit', 'Income'],
  },
  'kpi-gross-margin-ytd': {
    formula: 'Σ GrossProfit[ Jan … month ] / Σ Income[ Jan … month ] × 100',
    sources: ['GrossProfit', 'Income'],
  },
  'kpi-net-income-current-mo': {
    formula: 'NetIncome[month]',
    sources: ['NetIncome'],
  },
  'kpi-net-income-ytd': {
    formula: 'Σ NetIncome[ Jan … month ]',
    sources: ['NetIncome'],
    variance: 'YTD Net Income − PY to Date Net Income',
  },
  'kpi-py-net-income': {
    formula: 'Σ PriorYear.NetIncome[ Jan … month ]',
    sources: ['NetIncome (prior year)'],
  },
  'pnl-table-13mo': {
    formula: '13-month trailing window [ month−12 … month ]',
    sources: ['Income', 'COGS', 'GrossProfit', 'Expenses', 'NetOperatingIncome', 'OtherExpenses', 'NetOtherIncome', 'NetIncome'],
  },
  'trend-chart-expenses': {
    formula: 'Expenses[month] with 13-month rolling avg',
    sources: ['Expenses'],
    variance: 'Rolling avg = Σ Expenses[ month−12 … month ] / 13',
  },
};
