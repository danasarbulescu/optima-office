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
import { getWarehouseClassIndex, getCachedCarCount, setCachedCarCount, getCachedGallons, setCachedGallons, getCachedClassActuals, setCachedClassActuals } from '@/lib/warehouse';
import { getAllBudgetClassData, getBudgetMetricValue } from '@/lib/budget-data';
import { fetchCarCountData, aggregateCarCountByClass, fetchGallonsData, aggregateGallonsByClass, fetchAccountLevelPL } from '@/lib/cdata';
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

    // Map classId → CData table name (for P&L queries)
    const classTableMap = new Map(classIndex.map(c => [c.id, c.tableName]));

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

    // ── Fetch gallons actuals ──────────────────────────────────────────────
    const gallonsByClassId = new Map<string, number>();
    let needGallonsFetch = false;

    if (!refresh) {
      for (const bc of orderedClasses) {
        const cached = await getCachedGallons(entityId, bc.classId, month);
        if (cached !== null) {
          gallonsByClassId.set(bc.classId, cached);
        } else {
          needGallonsFetch = true;
          break;
        }
      }
    } else {
      needGallonsFetch = true;
    }

    if (needGallonsFetch) {
      const gallonsRows = await fetchGallonsData(cdataUser, cdataPat, catalog, month);
      console.log(`[SummaryBvA] CData Gallons fetch: ${gallonsRows.length} rows for ${month}`);

      const aggregated = aggregateGallonsByClass(gallonsRows);

      for (const bc of orderedClasses) {
        const actual = aggregated.get(bc.classId) ?? 0;
        gallonsByClassId.set(bc.classId, actual);
        setCachedGallons(entityId, bc.classId, month, actual).catch(() => {});
      }
    }

    // ── Fetch sales (income) actuals from P&L class tables ─────────────────
    const salesByClassId = new Map<string, number>();

    await Promise.all(
      orderedClasses.map(async bc => {
        const tableName = classTableMap.get(bc.classId);
        if (!tableName) return;

        try {
          let rows = refresh ? null : await getCachedClassActuals(entityId, bc.classId, month);
          if (!rows) {
            rows = await fetchAccountLevelPL(cdataUser, cdataPat, catalog, tableName, month);
            console.log(`[SummaryBvA] CData PL fetch for class ${bc.classId} (${bc.className}), ${rows.length} rows`);
            setCachedClassActuals(entityId, bc.classId, month, rows).catch(() => {});
          }
          // Sum all Income accounts
          let incomeTotal = 0;
          for (const row of rows) {
            if (row.rowGroup === 'Income') {
              incomeTotal += row.amount;
            }
          }
          salesByClassId.set(bc.classId, incomeTotal);
        } catch (err) {
          console.error(`[SummaryBvA] fetchAccountLevelPL failed for class ${bc.classId}:`, err);
          salesByClassId.set(bc.classId, 0);
        }
      }),
    );

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

    // Gallons row
    const gallonsRow: SummaryBvaRow = {
      label: 'Gallons',
      metricKey: 'totalGallons',
      byClass: {},
      total: { actual: 0, budget: 0 },
    };

    for (const bc of orderedClasses) {
      const actual = gallonsByClassId.get(bc.classId) ?? 0;
      const budgetClassData = budgetClasses.find(b => b.classId === bc.classId);
      const budget = budgetClassData
        ? getBudgetMetricValue(budgetClassData, 'totalGallons', month) ?? 0
        : 0;

      gallonsRow.byClass[bc.classId] = { actual, budget };
      gallonsRow.total.actual += actual;
      gallonsRow.total.budget += budget;
    }

    rows.push(gallonsRow);

    // Sales row (all income accounts from P&L)
    const salesRow: SummaryBvaRow = {
      label: 'Sales',
      metricKey: 'sales',
      format: 'currency',
      byClass: {},
      total: { actual: 0, budget: 0 },
    };

    for (const bc of orderedClasses) {
      const actual = salesByClassId.get(bc.classId) ?? 0;
      // Budget: sum all income account lines from budgetLines
      const budgetClassData = budgetClasses.find(b => b.classId === bc.classId);
      let budget = 0;
      if (budgetClassData) {
        // Find the "Total Income" subtotal line for the period budget
        const totalIncomeLine = budgetClassData.budgetLines.find(
          l => l.rowType === 'subtotal' && l.accountName === 'Total Income',
        );
        budget = totalIncomeLine?.monthly[month] ?? 0;
      }

      salesRow.byClass[bc.classId] = { actual, budget };
      salesRow.total.actual += actual;
      salesRow.total.budget += budget;
    }

    rows.push(salesRow);

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
