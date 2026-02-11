import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { WIDGET_TYPES, defaultWidgetName } from "@/widgets/registry";
import { getAllWidgetTypeMeta } from "@/lib/widget-type-meta";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Merge with DynamoDB overrides
  const overrides = await getAllWidgetTypeMeta();
  const overrideMap = new Map(overrides.map(o => [o.id, o.displayName]));

  const widgetTypes = WIDGET_TYPES.map(wt => {
    const fallback = defaultWidgetName(wt.id);
    return {
      ...wt,
      originalName: fallback,
      name: overrideMap.get(wt.id) || fallback,
      hasOverride: overrideMap.has(wt.id),
    };
  });

  return NextResponse.json({ widgetTypes });
}
