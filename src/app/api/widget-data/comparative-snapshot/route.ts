import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { fetchPLForEntities } from "@/lib/fetch-pl";
import { getEntities } from "@/lib/entities";
import { FinancialRow } from "@/lib/models/financial";
import { ComparativeSnapshotData, ComparativeSnapshotRow } from "@/lib/types";

const MONTH_ABBREVS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function sumPeriods(rows: FinancialRow[], category: string, year: number, months: number[]): number {
  const row = rows.find(r => r.category === category);
  if (!row) return 0;
  return months.reduce((sum, m) => {
    return sum + (row.periods[`${year}-${String(m).padStart(2, '0')}`] || 0);
  }, 0);
}

function getPeriod(rows: FinancialRow[], category: string, year: number, month: number): number {
  const row = rows.find(r => r.category === category);
  if (!row) return 0;
  return row.periods[`${year}-${String(month).padStart(2, '0')}`] || 0;
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function getQuarterForMonth(year: number, month: number): { qNum: number; qYear: number; months: number[] } {
  if (month <= 3) return { qNum: 1, qYear: year, months: [1, 2, 3] };
  if (month <= 6) return { qNum: 2, qYear: year, months: [4, 5, 6] };
  if (month <= 9) return { qNum: 3, qYear: year, months: [7, 8, 9] };
  return { qNum: 4, qYear: year, months: [10, 11, 12] };
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

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  try {
    const [yearStr, moStr] = month.split("-");
    const year = Number(yearStr);
    const moNum = parseInt(moStr, 10); // 1-based

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

    const cacheClientId = auth.clientId === '*' ? 'global' : auth.clientId;
    const { rows } = await fetchPLForEntities(cacheClientId, entityIds, entities, refresh);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No P&L data available" }, { status: 404 });
    }

    // Quarter and period setup
    const { qNum, qYear, months: qMonths } = getQuarterForMonth(year, moNum);
    const pyQYear = qYear - 1;
    const ytdMonths = Array.from({ length: moNum }, (_, i) => i + 1);

    // Column labels
    const currentQLabel      = `Q${qNum} ${qYear}`;
    const priorYearQLabel    = `Q${qNum} ${pyQYear}`;
    const currentMonthLabel  = `${MONTH_ABBREVS[moNum - 1]}${String(year).slice(2)}`;
    const priorYearMonthLabel = `${MONTH_ABBREVS[moNum - 1]}${String(year - 1).slice(2)}`;
    const ytdCurrentLabel    = `YTD${String(year).slice(2)}`;
    const ytdPriorLabel      = `YTD${String(year - 1).slice(2)}`;

    function buildRow(label: string, category: string, isBold = false): ComparativeSnapshotRow {
      const currentQ      = sumPeriods(rows, category, qYear, qMonths);
      const priorYearQ    = sumPeriods(rows, category, pyQYear, qMonths);
      const currentMonth  = getPeriod(rows, category, year, moNum);
      const priorYearMonth = getPeriod(rows, category, year - 1, moNum);
      const ytdCurrent    = sumPeriods(rows, category, year, ytdMonths);
      const ytdPrior      = sumPeriods(rows, category, year - 1, ytdMonths);
      return {
        label, isBold, isPct: false,
        currentQ, priorYearQ, chgQoQ: pctChange(currentQ, priorYearQ),
        currentMonth, priorYearMonth, chgMoM: pctChange(currentMonth, priorYearMonth),
        ytdCurrent, ytdPrior, chgYTD: pctChange(ytdCurrent, ytdPrior),
      };
    }

    function buildPctRow(label: string, numeratorCat: string, denominatorCat: string): ComparativeSnapshotRow {
      const pct = (n: number, d: number) => d !== 0 ? (n / d) * 100 : 0;

      const nCurQ  = sumPeriods(rows, numeratorCat, qYear, qMonths);
      const dCurQ  = sumPeriods(rows, denominatorCat, qYear, qMonths);
      const nPriQ  = sumPeriods(rows, numeratorCat, pyQYear, qMonths);
      const dPriQ  = sumPeriods(rows, denominatorCat, pyQYear, qMonths);
      const nCurMo = getPeriod(rows, numeratorCat, year, moNum);
      const dCurMo = getPeriod(rows, denominatorCat, year, moNum);
      const nPriMo = getPeriod(rows, numeratorCat, year - 1, moNum);
      const dPriMo = getPeriod(rows, denominatorCat, year - 1, moNum);
      const nYtdCur = sumPeriods(rows, numeratorCat, year, ytdMonths);
      const dYtdCur = sumPeriods(rows, denominatorCat, year, ytdMonths);
      const nYtdPri = sumPeriods(rows, numeratorCat, year - 1, ytdMonths);
      const dYtdPri = sumPeriods(rows, denominatorCat, year - 1, ytdMonths);

      const currentQ      = pct(nCurQ, dCurQ);
      const priorYearQ    = pct(nPriQ, dPriQ);
      const currentMonth  = pct(nCurMo, dCurMo);
      const priorYearMonth = pct(nPriMo, dPriMo);
      const ytdCurrent    = pct(nYtdCur, dYtdCur);
      const ytdPrior      = pct(nYtdPri, dYtdPri);

      return {
        label, isBold: false, isPct: true,
        currentQ, priorYearQ, chgQoQ: pctChange(currentQ, priorYearQ),
        currentMonth, priorYearMonth, chgMoM: pctChange(currentMonth, priorYearMonth),
        ytdCurrent, ytdPrior, chgYTD: pctChange(ytdCurrent, ytdPrior),
      };
    }

    const snapshotRows: ComparativeSnapshotRow[] = [
      buildRow('Total Revenue',           'Income'),
      buildRow('Total COGS',              'COGS'),
      buildRow('Gross Profit',            'GrossProfit',        true),
      buildPctRow('GP % of Revenue',      'GrossProfit',        'Income'),
      buildRow('Operating Expenses',      'Expenses'),
      buildRow('Operating Profit (Loss)', 'NetOperatingIncome', true),
      buildPctRow('Net Operating Profit %', 'NetOperatingIncome', 'Income'),
      buildRow('Other Income/(Expense)',  'NetOtherIncome'),
      buildRow('Net Income (Loss)',       'NetIncome',          true),
    ];

    const data: ComparativeSnapshotData = {
      rows: snapshotRows,
      currentQLabel, priorYearQLabel,
      currentMonthLabel, priorYearMonthLabel,
      ytdCurrentLabel, ytdPriorLabel,
    };

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Comparative snapshot API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
