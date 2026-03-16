import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getEntities } from "@/lib/entities";
import { getDataSource } from "@/lib/data-sources";
import { fetchFullPLRows, periodToColName } from "@/lib/cdata";
import { EntityConfig, CategoryPLDetailEntry, CategoryPLDetailData } from "@/lib/types";

const MONTH_ABBREVS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthLabel(m: string): string {
  const [year, mo] = m.split('-');
  return `${MONTH_ABBREVS[parseInt(mo, 10) - 1]} ${year.slice(2)}`;
}

function priorYearPeriod(period: string): string {
  const [y, mo] = period.split('-');
  return `${parseInt(y, 10) - 1}-${mo}`;
}

function buildRange(startMonth: string, endMonth: string): string[] {
  const periods: string[] = [];
  let [y, m] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    periods.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return periods;
}

function parseAccountCode(rawAccount: string): { code: string | null; name: string } {
  const match = rawAccount.match(/^(\d+(?:-\d+)?)\s+(.+)$/);
  return match ? { code: match[1], name: match[2] } : { code: null, name: rawAccount };
}

async function fetchEntityRawDataRows(entity: EntityConfig): Promise<Map<string, Record<string, any>>> {
  let user = process.env.CDATA_USER ?? '';
  let pat  = process.env.CDATA_PAT  ?? '';
  const catalogId = entity.sourceConfig?.catalogId || entity.catalogId;

  if (entity.dataSourceId) {
    const ds = await getDataSource(entity.dataSourceId);
    if (ds?.status === 'active') {
      user = ds.config.user || user;
      pat  = ds.config.pat  || pat;
    }
  }

  const rawRows = await fetchFullPLRows(user, pat, catalogId);
  const map = new Map<string, Record<string, any>>();
  for (const row of rawRows) {
    if (row.RowType !== 'Data') continue;
    const account = ((row.account ?? '') as string).trim();
    if (account) map.set(account, row);
  }
  return map;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const month = searchParams.get("month");
  const startMonth = searchParams.get("startMonth") || null;
  const entitiesParam = searchParams.get("entities");
  const categoryName = searchParams.get("category");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Missing or invalid month parameter" }, { status: 400 });
  }
  if (!entitiesParam) {
    return NextResponse.json({ error: "Missing entities parameter" }, { status: 400 });
  }
  if (!categoryName) {
    return NextResponse.json({ error: "Missing category parameter" }, { status: 400 });
  }

  const entityIds = entitiesParam.split(",").filter(Boolean);
  if (entityIds.length === 0) {
    return NextResponse.json({ error: "No entities specified" }, { status: 400 });
  }

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

    // Determine mode and periods
    const isRange = startMonth && /^\d{4}-\d{2}$/.test(startMonth) && startMonth < month;
    const mode: 'yoy' | 'range' = isRange ? 'range' : 'yoy';

    let periods: string[];
    let priorPeriods: string[] | undefined;

    if (mode === 'range') {
      periods = buildRange(startMonth!, month);
      priorPeriods = undefined;
    } else {
      periods = [month];
      priorPeriods = [priorYearPeriod(month)];
    }

    const allPeriods = priorPeriods ? [...periods, ...priorPeriods] : periods;

    const resolvedEntities = entityIds
      .map(id => entities.find(e => e.id === id))
      .filter((e): e is EntityConfig => !!e);

    // Find the category definition from the entities
    let categoryDef: { name: string; revenueAccounts: string[]; cogsAccounts: string[] } | undefined;
    for (const e of resolvedEntities) {
      categoryDef = (e.accountCategories || []).find(c => c.name === categoryName);
      if (categoryDef) break;
    }

    // If category not configured, return empty
    if (!categoryDef) {
      const empty: CategoryPLDetailData = {
        categoryName,
        mode,
        periods,
        periodLabels: periods.map(monthLabel),
        priorPeriods,
        priorPeriodLabels: priorPeriods?.map(monthLabel),
        incomeEntries: [],
        cogsEntries: [],
        incomeTotals: Object.fromEntries(allPeriods.map(p => [p, 0])),
        cogsTotals: Object.fromEntries(allPeriods.map(p => [p, 0])),
        gpTotals: Object.fromEntries(allPeriods.map(p => [p, 0])),
      };
      return NextResponse.json(empty);
    }

    // Fetch raw PL data per entity in parallel
    const entityRawPLs = await Promise.all(resolvedEntities.map(fetchEntityRawDataRows));

    // Merge amounts across entities: accountName → period → summed amount
    const incomeAmounts = new Map<string, Record<string, number>>();
    const cogsAmounts = new Map<string, Record<string, number>>();

    function accumulateAccount(
      targetMap: Map<string, Record<string, number>>,
      account: string,
      row: Record<string, any>,
    ) {
      if (!targetMap.has(account)) {
        targetMap.set(account, Object.fromEntries(allPeriods.map(p => [p, 0])));
      }
      const entry = targetMap.get(account)!;
      for (const p of allPeriods) {
        const col = periodToColName(p);
        const val = row[col];
        entry[p] += typeof val === 'number' ? val : parseFloat(val ?? '0') || 0;
      }
    }

    for (const rawPL of entityRawPLs) {
      for (const acct of categoryDef.revenueAccounts) {
        const row = rawPL.get(acct);
        if (row) accumulateAccount(incomeAmounts, acct, row);
      }
      for (const acct of categoryDef.cogsAccounts) {
        const row = rawPL.get(acct);
        if (row) accumulateAccount(cogsAmounts, acct, row);
      }
    }

    function buildEntries(
      accountList: string[],
      amountsMap: Map<string, Record<string, number>>,
      section: 'income' | 'cogs',
    ): CategoryPLDetailEntry[] {
      return accountList
        .filter(acct => amountsMap.has(acct))
        .map(acct => {
          const { code, name } = parseAccountCode(acct);
          return { code, name, section, amounts: amountsMap.get(acct)! };
        });
    }

    const incomeEntries = buildEntries(categoryDef.revenueAccounts, incomeAmounts, 'income');
    const cogsEntries = buildEntries(categoryDef.cogsAccounts, cogsAmounts, 'cogs');

    function sumEntries(entries: CategoryPLDetailEntry[], p: string): number {
      return entries.reduce((s, e) => s + (e.amounts[p] || 0), 0);
    }

    const incomeTotals = Object.fromEntries(allPeriods.map(p => [p, sumEntries(incomeEntries, p)]));
    const cogsTotals   = Object.fromEntries(allPeriods.map(p => [p, sumEntries(cogsEntries, p)]));
    const gpTotals     = Object.fromEntries(allPeriods.map(p => [p, incomeTotals[p] - cogsTotals[p]]));

    const data: CategoryPLDetailData = {
      categoryName,
      mode,
      periods,
      periodLabels: periods.map(monthLabel),
      priorPeriods,
      priorPeriodLabels: priorPeriods?.map(monthLabel),
      incomeEntries,
      cogsEntries,
      incomeTotals,
      cogsTotals,
      gpTotals,
    };

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Category P&L Detail API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
