import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getEntities } from "@/lib/entities";
import { getDataSource } from "@/lib/data-sources";
import { fetchFullPLRows, periodToColName } from "@/lib/cdata";
import { EntityConfig, RollingPLRow, RollingIncomeStatementData } from "@/lib/types";

const MONTH_ABBREVS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Canonical section ordering matches the QuickBooks P&L structure
const ROW_GROUP_ORDER: Record<string, number> = {
  Income: 0,
  COGS: 1,
  GrossProfit: 2,
  Expenses: 3,
  NetOperatingIncome: 4,
  OtherIncome: 5,
  OtherExpenses: 6,
  NetOtherIncome: 7,
  NetIncome: 8,
};

function compute13Months(endMonth: string): string[] {
  const [year, month] = endMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = 12; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function monthLabel(m: string): string {
  const [year, mo] = m.split('-');
  return `${MONTH_ABBREVS[parseInt(mo, 10) - 1]} ${year.slice(2)}`;
}

async function fetchEntityRows(entity: EntityConfig, months: string[]): Promise<RollingPLRow[]> {
  let user = process.env.CDATA_USER ?? '';
  let pat = process.env.CDATA_PAT ?? '';
  const catalogId = entity.sourceConfig?.catalogId || entity.catalogId;

  if (entity.dataSourceId) {
    const ds = await getDataSource(entity.dataSourceId);
    if (ds && ds.status === 'active') {
      user = ds.config.user || user;
      pat = ds.config.pat || pat;
    }
  }

  const rawRows = await fetchFullPLRows(user, pat, catalogId);

  return rawRows.map(raw => {
    const periods: Record<string, number> = {};
    for (const m of months) {
      const col = periodToColName(m);
      const val = raw[col];
      periods[m] = typeof val === 'number' ? val : parseFloat(val ?? '0') || 0;
    }
    return {
      account: ((raw.account ?? '') as string).trim(),
      rowGroup: (raw.RowGroup ?? '') as string,
      rowType: (raw.RowType ?? '') as string,
      rowId: raw.RowId as string | null,
      periods,
    };
  });
}

function mergeAndSort(entityRowSets: RollingPLRow[][], months: string[]): RollingPLRow[] {
  // Merge by (rowGroup, rowType, account) — sums period values for same account across entities.
  // Track the source index (position in the CData result) so we can restore the original order.
  const map = new Map<string, RollingPLRow>();
  const sourceIndexMap = new Map<string, number>(); // key → earliest source index seen

  for (const rows of entityRowSets) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = `${row.rowGroup}|||${row.rowType}|||${row.account}`;
      const existing = map.get(key);
      if (existing) {
        for (const m of months) {
          existing.periods[m] = (existing.periods[m] || 0) + (row.periods[m] || 0);
        }
        // Keep the smaller index so rows introduced by entity 1 retain their position
        const prev = sourceIndexMap.get(key) ?? i;
        if (i < prev) sourceIndexMap.set(key, i);
      } else {
        map.set(key, { ...row, periods: { ...row.periods } });
        sourceIndexMap.set(key, i);
      }
    }
  }

  return Array.from(map.entries()).sort(([keyA, a], [keyB, b]) => {
    // 1. Canonical RowGroup order (Income → COGS → GrossProfit → … → NetIncome)
    const ga = ROW_GROUP_ORDER[a.rowGroup] ?? 99;
    const gb = ROW_GROUP_ORDER[b.rowGroup] ?? 99;
    if (ga !== gb) return ga - gb;

    // 2. Within the same RowGroup, preserve the original CData row order
    return (sourceIndexMap.get(keyA) ?? 0) - (sourceIndexMap.get(keyB) ?? 0);
  }).map(([, row]) => row);
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Missing or invalid month parameter. Use ?month=YYYY-MM" }, { status: 400 });
  }

  const entitiesParam = request.nextUrl.searchParams.get("entities");
  if (!entitiesParam) return NextResponse.json({ error: "Missing entities parameter" }, { status: 400 });

  const entityIds = entitiesParam.split(",").filter(Boolean);
  if (entityIds.length === 0) return NextResponse.json({ error: "No entities specified" }, { status: 400 });

  try {
    const clientId = auth.isInternal && auth.clientId === '*' ? undefined : auth.clientId;
    const entities = await getEntities(clientId);
    const validIds = new Set(entities.map(e => e.id));
    const invalid = entityIds.filter(id => !validIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid entity IDs: ${invalid.join(", ")}` }, { status: 400 });
    }

    if (auth.authorizedEntityIds) {
      const authorizedSet = new Set(auth.authorizedEntityIds);
      const unauthorized = entityIds.filter(id => !authorizedSet.has(id));
      if (unauthorized.length > 0) {
        return NextResponse.json({ error: "Access denied: unauthorized entities" }, { status: 403 });
      }
    }

    const months = compute13Months(month);
    const monthLabels = months.map(monthLabel);

    const resolvedEntities = entityIds
      .map(id => entities.find(e => e.id === id))
      .filter((e): e is EntityConfig => !!e);

    // Fetch all entities in parallel — direct CData fetch (account-level data not in warehouse)
    const entityRowSets = await Promise.all(
      resolvedEntities.map(e => fetchEntityRows(e, months))
    );

    const merged = mergeAndSort(entityRowSets, months);

    // Remove rows where all 13 period values are zero.
    // Section rows (headers with no values) are kept only when their RowGroup has at least one non-zero Data/Summary row.
    const nonEmptyGroups = new Set(
      merged
        .filter(r => r.rowType !== 'Section' && months.some(m => r.periods[m] !== 0))
        .map(r => r.rowGroup)
    );
    const filtered = merged.filter(r =>
      r.rowType === 'Section'
        ? nonEmptyGroups.has(r.rowGroup)
        : months.some(m => r.periods[m] !== 0)
    );

    const incomeTotalRow = filtered.find(r => r.rowGroup === 'Income' && r.rowType === 'Summary' && (r.rowId === null || r.rowId === ''));

    function pctRow(label: string, rowGroup: string, rowType: string, numeratorRow: RollingPLRow | undefined): RollingPLRow | null {
      if (!numeratorRow || !incomeTotalRow) return null;
      const periods: Record<string, number> = {};
      for (const m of months) {
        const num = numeratorRow.periods[m] || 0;
        const denom = incomeTotalRow.periods[m] || 0;
        periods[m] = denom !== 0 ? num / denom : 0;
      }
      return { account: label, rowGroup, rowType, rowId: null, periods };
    }

    // Inject GP% after last GrossProfit row, NOP% after last NetOperatingIncome row
    const gpTotalRow  = filtered.find(r => r.rowGroup === 'GrossProfit'        && r.rowType === 'Summary' && (r.rowId === null || r.rowId === ''));
    const nopTotalRow = filtered.find(r => r.rowGroup === 'NetOperatingIncome' && r.rowType === 'Summary' && (r.rowId === null || r.rowId === ''));
    const niTotalRow  = filtered.find(r => r.rowGroup === 'NetIncome'          && r.rowType === 'Summary' && (r.rowId === null || r.rowId === ''));
    const gpPctRow  = pctRow('Gross Profit %',        'GrossProfit',        'GpPercent',  gpTotalRow);
    const nopPctRow = pctRow('Net Operating Profit %', 'NetOperatingIncome', 'NopPercent', nopTotalRow);
    const niPctRow  = pctRow('Net Income %',           'NetIncome',          'NiPercent',  niTotalRow);

    let rows = filtered;
    if (gpPctRow || nopPctRow || niPctRow) {
      rows = [];
      const groups = filtered.map(r => r.rowGroup);
      const lastGpIdx  = groups.lastIndexOf('GrossProfit');
      const lastNopIdx = groups.lastIndexOf('NetOperatingIncome');
      const lastNiIdx  = groups.lastIndexOf('NetIncome');
      for (let i = 0; i < filtered.length; i++) {
        rows.push(filtered[i]);
        if (i === lastGpIdx  && gpPctRow)  rows.push(gpPctRow);
        if (i === lastNopIdx && nopPctRow) rows.push(nopPctRow);
        if (i === lastNiIdx  && niPctRow)  rows.push(niPctRow);
      }
    }

    const data: RollingIncomeStatementData = { months, monthLabels, rows };
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Rolling income statement API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
