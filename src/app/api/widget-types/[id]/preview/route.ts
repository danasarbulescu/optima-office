import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getWidgetType } from "@/widgets/registry";
import { getWarehouseData } from "@/lib/warehouse";
import { docClient } from "@/lib/dynamo";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { buildGroupValues, computeKPIs, build13MonthPnL, buildExpensesTrend, subtractMonths } from "@/lib/compute";

const META_TABLE = process.env.WIDGET_TYPE_META_TABLE || '';
const CONFIG_ID = '__preview-config__';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  const { id } = await params;
  const wt = getWidgetType(id);
  if (!wt) {
    return NextResponse.json({ error: "Widget type not found" }, { status: 404 });
  }

  // Read the configured preview entity
  if (!META_TABLE) {
    return NextResponse.json({ available: false });
  }

  const config = await docClient.send(new GetCommand({
    TableName: META_TABLE,
    Key: { id: CONFIG_ID },
  }));

  const previewEntityId = config.Item?.previewEntityId;
  if (!previewEntityId) {
    return NextResponse.json({ available: false });
  }

  const rows = await getWarehouseData(previewEntityId);
  if (!rows || rows.length === 0) {
    return NextResponse.json({ available: false });
  }

  // Derive the latest month that has non-zero data (CData returns future months as 0)
  const activePeriods = [...new Set(rows.flatMap(r =>
    Object.entries(r.periods).filter(([, v]) => v !== 0).map(([p]) => p),
  ))].sort();
  if (activePeriods.length === 0) {
    return NextResponse.json({ available: false });
  }

  // Use ?month= param if provided, otherwise default to latest active month
  const monthParam = request.nextUrl.searchParams.get('month');
  const selectedMonth = (monthParam && /^\d{4}-\d{2}$/.test(monthParam))
    ? monthParam
    : activePeriods[activePeriods.length - 1];
  const [yearStr, moStr] = selectedMonth.split('-');
  const year = Number(yearStr);
  const monthIdx = parseInt(moStr, 10) - 1;

  const curGroups = buildGroupValues(rows, year);
  const pyGroups = buildGroupValues(rows, year - 1);
  const pyHasData = [...pyGroups.values()].some(arr =>
    arr.slice(0, 12).some(v => v !== 0),
  );

  switch (wt.component) {
    case 'KpiCard': {
      const kpis = computeKPIs(curGroups, pyHasData ? pyGroups : null, monthIdx);
      return NextResponse.json({ available: true, component: 'KpiCard', kpis, selectedMonth });
    }
    case 'PnlTable': {
      const pnl = build13MonthPnL(curGroups, pyHasData ? pyGroups : null, selectedMonth);
      return NextResponse.json({ available: true, component: 'PnlTable', pnl, selectedMonth });
    }
    case 'TrendChart': {
      const startMonth = subtractMonths(selectedMonth, 11);
      const data = buildExpensesTrend(rows, startMonth, selectedMonth);
      return NextResponse.json({ available: true, component: 'TrendChart', data, selectedMonth, entityName: 'Preview' });
    }
    default:
      return NextResponse.json({ available: false });
  }
}
