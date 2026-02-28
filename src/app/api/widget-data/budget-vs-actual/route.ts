/**
 * GET /api/widget-data/budget-vs-actual
 *
 * Returns budget vs. actuals data for a P&L comparison widget.
 *
 * Query params:
 *   entities  (required) Single entity UUID
 *   month     (required) Period in YYYY-MM format
 *
 * Response: BudgetVsActualData
 *   rows[]      — account/subtotal/section rows; each has byClass (classId → actual+budget) and total
 *   classes[]   — ordered list of classes (classId, className, locationCode)
 *   daysInMonth — total days in the requested month (for client-side forecast)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { getEntities } from '@/lib/entities';
import { getDataSource } from '@/lib/data-sources';
import { getWarehouseClassIndex } from '@/lib/warehouse';
import { getAllBudgetClassData } from '@/lib/budget-data';
import { fetchAccountLevelPL } from '@/lib/cdata';
import { BudgetLine, BudgetVsActualData, BudgetVsActualRow } from '@/lib/types';

// ── Subtotal accumulator algorithm ───────────────────────────────────────────

/**
 * Walk the budget lines and compute actuals for each row (including subtotals).
 * Account rows get their actual from accountActuals map.
 * Subtotal rows accumulate from child account rows at depth+1.
 * Section rows (headers) remain 0.
 */
function computeRowActuals(
  lines: BudgetLine[],
  accountActuals: Map<string, number>,
): number[] {
  const result = new Array(lines.length).fill(0);
  const sums: number[] = new Array(10).fill(0);

  for (let i = 0; i < lines.length; i++) {
    const { rowType, depth, accountCode } = lines[i];
    if (rowType === 'account' && accountCode) {
      const actual = accountActuals.get(accountCode) ?? 0;
      result[i] = actual;
      sums[depth] = (sums[depth] ?? 0) + actual;
    } else if (rowType === 'subtotal') {
      const actual = sums[depth + 1] ?? 0;
      result[i] = actual;
      sums[depth + 1] = 0;
      sums[depth] = (sums[depth] ?? 0) + actual;
    }
    // section rows: result[i] remains 0
  }

  return result;
}

// ── Route handler ─────────────────────────────────────────────────────────────

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

  // Use first entity ID (budget-vs-actual is single-entity)
  const entityId = entitiesParam.split(',')[0];
  const [yearStr, moStr] = month.split('-');
  const year = parseInt(yearStr, 10);

  // Days in month calculation
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

    // ── Get warehouse class index (tableName per class) ─────────────────────
    const classIndex = await getWarehouseClassIndex(entityId);
    if (!classIndex || classIndex.length === 0) {
      return NextResponse.json(
        { error: 'No class index found. Run entity sync first.' },
        { status: 404 },
      );
    }

    // ── Get budget data from DynamoDB ───────────────────────────────────────
    const budgetClasses = await getAllBudgetClassData(entityId, year);
    if (budgetClasses.length === 0) {
      return NextResponse.json(
        { error: `No budget data found for year ${year}. Run import-budget.ts first.` },
        { status: 404 },
      );
    }

    // Build map: classId → BudgetClassData
    const budgetByClassId = new Map(budgetClasses.map(bc => [bc.classId, bc]));

    // Match budget classes to warehouse index (for tableName)
    const classTableMap = new Map(classIndex.map(c => [c.id, c.tableName]));

    // ── Fetch account-level actuals from CData (parallel) ──────────────────
    const actualsByClassId = new Map<string, Map<string, number>>();

    await Promise.all(
      budgetClasses.map(async bc => {
        const tableName = classTableMap.get(bc.classId);
        if (!tableName) return; // no warehouse entry for this class

        try {
          const rows = await fetchAccountLevelPL(cdataUser, cdataPat, catalog, tableName, month);
          const map = new Map<string, number>();
          for (const row of rows) {
            if (row.accountCode) {
              map.set(row.accountCode, row.amount);
            }
          }
          actualsByClassId.set(bc.classId, map);
        } catch (err) {
          console.error(`fetchAccountLevelPL failed for class ${bc.classId}:`, err);
          actualsByClassId.set(bc.classId, new Map());
        }
      }),
    );

    // ── Use the first budget class as the canonical row structure ───────────
    // All classes share the same P&L account structure (same Excel template)
    const canonicalClass = budgetClasses[0];
    const lines = canonicalClass.budgetLines;

    // Ordered class list (sorted by locationCode)
    const orderedClasses = [...budgetClasses].sort((a, b) =>
      (a.locationCode ?? '').localeCompare(b.locationCode ?? ''),
    );

    // ── Build per-row actuals and budget for each class ────────────────────
    // Map: classId → number[] of actuals (one per line, including subtotals)
    const actualsByClass = new Map<string, number[]>();
    const budgetByClass  = new Map<string, number[]>();

    for (const bc of orderedClasses) {
      const accountActuals = actualsByClassId.get(bc.classId) ?? new Map<string, number>();
      actualsByClass.set(bc.classId, computeRowActuals(lines, accountActuals));

      // Budget amounts: each line's monthly value for this period
      const budgetAmts = lines.map(l => l.monthly[month] ?? 0);
      // For this class's budget data (may have different lines ordering — use same canonical lines)
      const thisBudgetLines = budgetByClassId.get(bc.classId)?.budgetLines ?? lines;
      const thisBudgetMap = new Map(
        thisBudgetLines.map(bl => [bl.accountCode ?? `__${bl.accountName}`, bl.monthly[month] ?? 0]),
      );
      budgetByClass.set(
        bc.classId,
        lines.map(l => thisBudgetMap.get(l.accountCode ?? `__${l.accountName}`) ?? 0),
      );
    }

    // ── Also compute budget subtotals using the accumulator algorithm ───────
    for (const bc of orderedClasses) {
      const budgetActualsMap = new Map<string, number>();
      const thisBudgetLines = budgetByClassId.get(bc.classId)?.budgetLines ?? lines;
      for (const bl of thisBudgetLines) {
        if (bl.accountCode && bl.rowType === 'account') {
          budgetActualsMap.set(bl.accountCode, bl.monthly[month] ?? 0);
        }
      }
      budgetByClass.set(bc.classId, computeRowActuals(lines, budgetActualsMap));
    }

    // ── Assemble response rows ─────────────────────────────────────────────
    const rows: BudgetVsActualRow[] = lines.map((line, i) => {
      const byClass: Record<string, { actual: number; budget: number }> = {};
      let totalActual = 0;
      let totalBudget = 0;

      for (const bc of orderedClasses) {
        const actual = actualsByClass.get(bc.classId)?.[i] ?? 0;
        const budget = budgetByClass.get(bc.classId)?.[i] ?? 0;
        byClass[bc.classId] = { actual, budget };
        totalActual += actual;
        totalBudget += budget;
      }

      return {
        accountCode: line.accountCode,
        accountName: line.accountName,
        rowType: line.rowType,
        depth: line.depth,
        byClass,
        total: { actual: totalActual, budget: totalBudget },
      };
    });

    const response: BudgetVsActualData = {
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
    console.error('budget-vs-actual API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
