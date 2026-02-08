import { NextRequest, NextResponse } from "next/server";
import { buildExpensesTrend } from "@/lib/compute";
import { fetchPLForEntities } from "@/lib/fetch-pl";
import { getEntities } from "@/lib/entities";
import type { AuthContext } from "@/lib/types";

export async function handleGet(request: NextRequest, auth: AuthContext): Promise<Response> {
  const startMonth = request.nextUrl.searchParams.get("startMonth");
  const endMonth = request.nextUrl.searchParams.get("endMonth");
  const monthPattern = /^\d{4}-\d{2}$/;

  if (!startMonth || !endMonth || !monthPattern.test(startMonth) || !monthPattern.test(endMonth)) {
    return NextResponse.json(
      { error: "Missing or invalid parameters. Use ?startMonth=YYYY-MM&endMonth=YYYY-MM" },
      { status: 400 }
    );
  }

  if (startMonth > endMonth) {
    return NextResponse.json(
      { error: "startMonth must be <= endMonth" },
      { status: 400 }
    );
  }

  const entitiesParam = request.nextUrl.searchParams.get("entities");
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  if (!entitiesParam) {
    return NextResponse.json({ error: "Missing entities parameter" }, { status: 400 });
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

    const cacheClientId = auth.clientId === '*' ? 'global' : auth.clientId;
    const { rows, entityName } = await fetchPLForEntities(cacheClientId, entityIds, entities, refresh);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No P&L summary data returned from CData." },
        { status: 404 }
      );
    }

    const data = buildExpensesTrend(rows, startMonth, endMonth);

    return NextResponse.json({ data, entityName });
  } catch (err: any) {
    console.error("Trend API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
