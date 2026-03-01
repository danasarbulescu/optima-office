/**
 * GET /api/widget-data/summary-bva
 *
 * Returns summary budget-vs-actuals data for operational metrics (car count, etc.).
 * Actuals come from the CData CarCount table; budget from BudgetMetric in DynamoDB.
 *
 * Query params:
 *   entities  (required) Single entity UUID
 *   month     (required) Period in YYYY-MM format
 *   refresh   (optional) "true" to bypass cache
 *
 * Response: SummaryBvaData
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { getEntities } from '@/lib/entities';
import { getDataSource } from '@/lib/data-sources';
import { getWarehouseClassIndex, getCachedCarCount, setCachedCarCount } from '@/lib/warehouse';
import { getAllBudgetClassData, getBudgetMetricValue } from '@/lib/budget-data';
import { fetchCarCountData, aggregateCarCountByClass } from '@/lib/cdata';
import { SummaryBvaData, SummaryBvaRow } from '@/lib/types';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get('x-client-id'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const entitiesParam = params.get('entities');
  const month = params.get('month');

  if (!entitiesParam) {
    return NextResponse.json({ error: 'Missing entities parameter' }, { status: 400 });
  }
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: 'Missing or invalid month parameter. Use ?month=YYYY-MM' },
      { status: 400 },
    );
  }

  const refresh = params.get('refresh') === 'true';
  const entityId = entitiesParam.split(',')[0];
  const [yearStr, moStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const daysInMonth = new Date(year, parseInt(moStr, 10), 0).getDate();

  try {
    // ── Validate entity access ──────────────────────────────────────────────
    const clientId = auth.isInternal && auth.clientId === '*' ? undefined : auth.clientId;
    const entities = await getEntities(clientId);
    const entity = entities.find(e => e.id === entityId);
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found or access denied' }, { status: 404 });
    }

    if (auth.authorizedEntityIds) {
      if (!auth.authorizedEntityIds.includes(entityId)) {
        return NextResponse.json({ error: 'Access denied: unauthorized entity' }, { status: 403 });
      }
    }

    // ── Resolve CData credentials ───────────────────────────────────────────
    let cdataUser = process.env.CDATA_USER ?? '';
    let cdataPat  = process.env.CDATA_PAT ?? '';
    let catalog   = entity.sourceConfig?.catalogId ?? entity.catalogId ?? process.env.CDATA_CATALOG ?? '';

    if (entity.dataSourceId) {
      const ds = await getDataSource(entity.dataSourceId);
      if (ds?.status === 'active') {
        cdataUser = ds.config.user ?? cdataUser;
        cdataPat  = ds.config.pat  ?? cdataPat;
        catalog   = entity.sourceConfig?.catalogId ?? catalog;
      }
    }

    if (!cdataUser || !cdataPat || !catalog) {
      return NextResponse.json(
        { error: 'CData credentials not configured for this entity' },
        { status: 500 },
      );
    }

    // ── Get warehouse class index ───────────────────────────────────────────
    const classIndex = await getWarehouseClassIndex(entityId);
    if (!classIndex || classIndex.length === 0) {
      return NextResponse.json(
        { error: 'No class index found. Run entity sync first.' },
        { status: 404 },
      );
    }

    // ── Get budget data from DynamoDB ────────────────────────────────────────
    const budgetClasses = await getAllBudgetClassData(entityId, year);
    if (budgetClasses.length === 0) {
      return NextResponse.json(
        { error: `No budget data found for year ${year}. Run import-budget.ts first.` },
        { status: 404 },
      );
    }

    // Ordered class list (sorted by locationCode)
    const orderedClasses = [...budgetClasses].sort((a, b) =>
      (a.locationCode ?? '').localeCompare(b.locationCode ?? ''),
    );

    // ── Fetch car count actuals ─────────────────────────────────────────────
    // Try per-class cache first; on miss fetch all from CData and distribute
    const carCountByClassId = new Map<string, number>();
    let needFetch = false;

    if (!refresh) {
      for (const bc of orderedClasses) {
        const cached = await getCachedCarCount(entityId, bc.classId, month);
        if (cached !== null) {
          carCountByClassId.set(bc.classId, cached);
        } else {
          needFetch = true;
          break; // if any class misses cache, fetch all from CData
        }
      }
    } else {
      needFetch = true;
    }

    if (needFetch) {
      // Fetch all car count rows for the month from CData
      const carCountRows = await fetchCarCountData(cdataUser, cdataPat, catalog, month);
      console.log(`[SummaryBvA] CData CarCount fetch: ${carCountRows.length} rows for ${month}`);

      const aggregated = aggregateCarCountByClass(carCountRows);

      // Distribute to budget classes (match Class_Id from CData to budget classId)
      for (const bc of orderedClasses) {
        const actual = aggregated.get(bc.classId) ?? 0;
        carCountByClassId.set(bc.classId, actual);
        // Cache per class (fire-and-forget)
        setCachedCarCount(entityId, bc.classId, month, actual).catch(() => {});
      }
    }

    // ── Build response rows ─────────────────────────────────────────────────
    const rows: SummaryBvaRow[] = [];

    // Car Count row
    const carCountRow: SummaryBvaRow = {
      label: 'Car Count',
      metricKey: 'carCount',
      byClass: {},
      total: { actual: 0, budget: 0 },
    };

    for (const bc of orderedClasses) {
      const actual = carCountByClassId.get(bc.classId) ?? 0;
      const budgetClassData = budgetClasses.find(b => b.classId === bc.classId);
      const budget = budgetClassData
        ? getBudgetMetricValue(budgetClassData, 'carCount', month) ?? 0
        : 0;

      carCountRow.byClass[bc.classId] = { actual, budget };
      carCountRow.total.actual += actual;
      carCountRow.total.budget += budget;
    }

    rows.push(carCountRow);

    const response: SummaryBvaData = {
      month,
      year,
      daysInMonth,
      entityId,
      classes: orderedClasses.map(bc => ({
        classId: bc.classId,
        className: bc.className,
        locationCode: bc.locationCode,
      })),
      rows,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('summary-bva API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
