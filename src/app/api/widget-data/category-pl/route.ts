import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getEntities } from "@/lib/entities";
import { getDataSource } from "@/lib/data-sources";
import { fetchFullPLRows, periodToColName } from "@/lib/cdata";
import { EntityConfig, AccountCategory, CategoryPLData, CategoryPLGroup, CategoryPLRow } from "@/lib/types";

const MONTH_ABBREVS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

/** Per-entity accumulated amounts: categoryName → { revenue, cogs } per month */
type CategoryAmounts = Record<string, { revenue: Record<string, number>; cogs: Record<string, number> }>;

async function fetchEntityCategoryAmounts(
  entity: EntityConfig,
  months: string[],
): Promise<CategoryAmounts> {
  const categories = entity.accountCategories;
  if (!categories || categories.length === 0) return {};

  let user = process.env.CDATA_USER ?? '';
  let pat  = process.env.CDATA_PAT  ?? '';
  const catalogId = entity.sourceConfig?.catalogId || entity.catalogId;

  if (entity.dataSourceId) {
    const ds = await getDataSource(entity.dataSourceId);
    if (ds && ds.status === 'active') {
      user = ds.config.user || user;
      pat  = ds.config.pat  || pat;
    }
  }

  const rawRows = await fetchFullPLRows(user, pat, catalogId);

  // Build account → periods map (Data rows only)
  const accountPeriods = new Map<string, Record<string, number>>();
  for (const raw of rawRows) {
    if (raw.RowType !== 'Data') continue;
    const account = ((raw.account ?? '') as string).trim();
    if (!account) continue;
    const periods: Record<string, number> = {};
    for (const m of months) {
      const col = periodToColName(m);
      const val = raw[col];
      periods[m] = typeof val === 'number' ? val : parseFloat(val ?? '0') || 0;
    }
    accountPeriods.set(account, periods);
  }

  const result: CategoryAmounts = {};
  for (const cat of categories) {
    result[cat.name] = { revenue: {}, cogs: {} };
    for (const m of months) {
      result[cat.name].revenue[m] = cat.revenueAccounts
        .reduce((sum, acct) => sum + (accountPeriods.get(acct)?.[m] || 0), 0);
      result[cat.name].cogs[m] = cat.cogsAccounts
        .reduce((sum, acct) => sum + (accountPeriods.get(acct)?.[m] || 0), 0);
    }
  }
  return result;
}

/** Merge same-named categories across entities by summing amounts */
function mergeAmounts(sets: CategoryAmounts[], months: string[]): CategoryAmounts {
  const merged: CategoryAmounts = {};
  for (const set of sets) {
    for (const [name, amounts] of Object.entries(set)) {
      if (!merged[name]) {
        merged[name] = { revenue: {}, cogs: {} };
        for (const m of months) { merged[name].revenue[m] = 0; merged[name].cogs[m] = 0; }
      }
      for (const m of months) {
        merged[name].revenue[m] += amounts.revenue[m] || 0;
        merged[name].cogs[m]    += amounts.cogs[m]    || 0;
      }
    }
  }
  return merged;
}

/** Build the 4 summary rows for a category */
function buildCategoryGroup(name: string, amounts: { revenue: Record<string, number>; cogs: Record<string, number> }, months: string[]): CategoryPLGroup {
  const gpValues: Record<string, number> = {};
  const gpPctValues: Record<string, number> = {};
  for (const m of months) {
    const rev = amounts.revenue[m] || 0;
    const cogs = amounts.cogs[m] || 0;
    gpValues[m] = rev - cogs;
    gpPctValues[m] = rev !== 0 ? (rev - cogs) / rev : 0;
  }

  const rows: CategoryPLRow[] = [
    { label: 'Revenue',       values: { ...amounts.revenue }, isPct: false, isBold: false },
    { label: 'Cost of Goods', values: { ...amounts.cogs },    isPct: false, isBold: false },
    { label: 'Gross Profit',  values: gpValues,               isPct: false, isBold: true  },
    { label: 'Gross Profit %',values: gpPctValues,            isPct: true,  isBold: true  },
  ];

  return { name, rows };
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

    // Fetch category amounts per entity in parallel
    const entityAmountSets = await Promise.all(
      resolvedEntities.map(e => fetchEntityCategoryAmounts(e, months))
    );

    const merged = mergeAmounts(entityAmountSets, months);

    // Preserve category order from the first entity that defines them
    const orderedNames: string[] = [];
    for (const e of resolvedEntities) {
      for (const cat of (e.accountCategories || [])) {
        if (!orderedNames.includes(cat.name)) orderedNames.push(cat.name);
      }
    }

    const groups: CategoryPLGroup[] = orderedNames
      .filter(name => merged[name])
      .map(name => buildCategoryGroup(name, merged[name], months));

    const data: CategoryPLData = { months, monthLabels, groups };
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Category P&L API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
