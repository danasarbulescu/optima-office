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

// Sort weight within a RowGroup: Section < Data < Summary-subtotal < Summary-total
function rowTypeSortOrder(rowType: string, rowId: string | null): number {
  if (rowType === 'Section') return 0;
  if (rowType === 'Data') return 1;
  if (rowType === 'Summary' && rowId !== null && rowId !== '') return 2;
  return 3; // Summary group total (RowId IS NULL)
}

// Extract leading account code number for sorting (e.g. "40010" from "40010 Food Sales")
function accountCodeKey(account: string): number {
  const m = /^(\d+)/.exec(account.trim());
  return m ? parseInt(m[1], 10) : 999999;
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
  // Merge by (rowGroup, rowType, account) — sums period values for same account across entities
  const map = new Map<string, RollingPLRow>();

  for (const rows of entityRowSets) {
    for (const row of rows) {
      const key = `${row.rowGroup}|||${row.rowType}|||${row.account}`;
      const existing = map.get(key);
      if (existing) {
        for (const m of months) {
          existing.periods[m] = (existing.periods[m] || 0) + (row.periods[m] || 0);
        }
      } else {
        map.set(key, { ...row, periods: { ...row.periods } });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    // 1. Section order
    const ga = ROW_GROUP_ORDER[a.rowGroup] ?? 99;
    const gb = ROW_GROUP_ORDER[b.rowGroup] ?? 99;
    if (ga !== gb) return ga - gb;

    // 2. Row type order within section
    const ta = rowTypeSortOrder(a.rowType, a.rowId);
    const tb = rowTypeSortOrder(b.rowType, b.rowId);
    if (ta !== tb) return ta - tb;

    // 3. For data rows: sort by account code number, then name
    if (a.rowType === 'Data') {
      const ca = accountCodeKey(a.account);
      const cb = accountCodeKey(b.account);
      if (ca !== cb) return ca - cb;
    }

    return a.account.localeCompare(b.account);
  });
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

    const rows = mergeAndSort(entityRowSets, months);

    const data: RollingIncomeStatementData = { months, monthLabels, rows };
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Rolling income statement API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
