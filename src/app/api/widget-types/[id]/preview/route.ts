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

  // Derive the latest month from the data
  const allPeriods = rows.flatMap(r => Object.keys(r.periods));
  if (allPeriods.length === 0) {
    return NextResponse.json({ available: false });
  }
  const latestMonth = allPeriods.sort().pop()!;
  const [yearStr, moStr] = latestMonth.split('-');
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
      return NextResponse.json({ available: true, component: 'KpiCard', kpis, selectedMonth: latestMonth });
    }
    case 'PnlTable': {
      const pnl = build13MonthPnL(curGroups, pyHasData ? pyGroups : null, latestMonth);
      return NextResponse.json({ available: true, component: 'PnlTable', pnl, selectedMonth: latestMonth });
    }
    case 'TrendChart': {
      const startMonth = subtractMonths(latestMonth, 11);
      const data = buildExpensesTrend(rows, startMonth, latestMonth);
      return NextResponse.json({ available: true, component: 'TrendChart', data, entityName: 'Preview' });
    }
    default:
      return NextResponse.json({ available: false });
  }
}
