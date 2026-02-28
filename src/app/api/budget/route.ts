/**
 * GET /api/budget
 *
 * Returns budget data for an entity, optionally filtered by class and/or account code.
 *
 * Query params:
 *   entityId   (required) Entity UUID
 *   year       (optional) Fiscal year, default 2026
 *   classId    (optional) Filter to a specific QB class ID; omit for all classes
 *   account    (optional) Filter budget lines to a specific account code (e.g. "4004-00")
 *   period     (optional) Return only budget amounts for this period (YYYY-MM);
 *                         without period, all monthly values are returned
 *
 * Response: { year, entityId, classes: BudgetClassData[] }
 *   Each class has budgetLines[] and metrics[].
 *   If ?account= is specified, budgetLines is filtered to that account only.
 *   If ?period= is specified, each line's monthly map is filtered to that period.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import {
  getBudgetClassData,
  getAllBudgetClassData,
  getBudgetMetadata,
} from '@/lib/budget-data';
import { BudgetClassData } from '@/lib/types';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get('x-client-id'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const entityId = params.get('entityId');
  const yearParam = params.get('year');
  const classId = params.get('classId');
  const accountCode = params.get('account');
  const period = params.get('period');

  if (!entityId) {
    return NextResponse.json({ error: 'Missing entityId parameter' }, { status: 400 });
  }

  if (period && !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json(
      { error: 'Invalid period format. Use YYYY-MM' },
      { status: 400 },
    );
  }

  const year = yearParam ? parseInt(yearParam, 10) : 2026;

  // ── Fetch class data ─────────────────────────────────────────────────────
  let classes: BudgetClassData[];

  if (classId) {
    const single = await getBudgetClassData(entityId, year, classId);
    classes = single ? [single] : [];
  } else {
    classes = await getAllBudgetClassData(entityId, year);
  }

  if (classes.length === 0) {
    // Return empty with metadata so client knows years available
    const meta = await getBudgetMetadata(entityId, year);
    return NextResponse.json({
      year,
      entityId,
      classes: [],
      message: meta
        ? `No classes found for year ${year}`
        : `No budget data found for year ${year}. Run import-budget.ts to load data.`,
    });
  }

  // ── Apply filters ────────────────────────────────────────────────────────
  const result = classes.map(cls => {
    let lines = cls.budgetLines;

    // Filter by account code
    if (accountCode) {
      lines = lines.filter(l => l.accountCode === accountCode);
    }

    // Filter monthly map to specific period
    if (period) {
      lines = lines.map(l => ({
        ...l,
        monthly: { [period]: l.monthly[period] ?? 0 },
      }));
    }

    return { ...cls, budgetLines: lines };
  });

  return NextResponse.json({ year, entityId, classes: result });
}
