import { KPIs } from '@/lib/types';
import { formatAbbrev, formatPct, formatVariance } from '@/lib/format';
import { KpiWidgetConfig } from '../kpi-config';

export default function KpiCard({ config, kpis }: { config: KpiWidgetConfig; kpis: KPIs }) {
  const rawValue = kpis[config.field];
  const isNull = rawValue === null || rawValue === undefined;
  const na = 'N/A';

  let displayValue: string;
  if (config.nullable && isNull) {
    displayValue = na;
  } else {
    const val = (rawValue as number) ?? 0;
    displayValue = config.format === 'percent' ? formatPct(val) : formatAbbrev(val);
  }

  // Variance
  let varianceHTML: React.ReactNode = null;
  if (config.varianceField) {
    const varianceVal = kpis[config.varianceField] as number | null;
    if (varianceVal !== null && varianceVal !== undefined) {
      const color = varianceVal >= 0 ? '#2ecc71' : '#e74c3c';
      let pctStr = '';
      if (config.variancePctField) {
        const pctVal = kpis[config.variancePctField] as number | null;
        if (pctVal !== null && pctVal !== undefined) {
          pctStr = `  ${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%`;
        }
      }
      varianceHTML = (
        <>
          <div className="variance" style={{ color }}>
            {formatVariance(varianceVal)}{pctStr}
          </div>
          {config.varianceLabel && <div className="sub-label">{config.varianceLabel}</div>}
        </>
      );
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        {config.headerLine1}<br />{config.headerLine2}
      </div>
      <div className="card-body">
        <div className="kpi-value">{displayValue}</div>
        {varianceHTML}
      </div>
    </div>
  );
}
