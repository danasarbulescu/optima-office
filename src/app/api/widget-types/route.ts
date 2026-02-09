import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { WIDGET_TYPES, getWidgetTypesByDataSource } from "@/widgets/registry";
import { getAllWidgetTypeMeta } from "@/lib/widget-type-meta";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dataSourceType = request.nextUrl.searchParams.get("dataSourceType");
  const baseTypes = dataSourceType
    ? getWidgetTypesByDataSource(dataSourceType)
    : WIDGET_TYPES;

  // Merge with DynamoDB overrides
  const overrides = await getAllWidgetTypeMeta();
  const overrideMap = new Map(overrides.map(o => [o.id, o.displayName]));

  const widgetTypes = baseTypes.map(wt => ({
    ...wt,
    originalName: wt.name,
    name: overrideMap.get(wt.id) || wt.name,
    hasOverride: overrideMap.has(wt.id),
  }));

  return NextResponse.json({ widgetTypes });
}
