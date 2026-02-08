import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { buildGroupValues, computeKPIs, build13MonthPnL } from "@/lib/compute";
import { fetchPLForEntities } from "@/lib/fetch-pl";
import { getEntities } from "@/lib/entities";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "Missing or invalid month parameter. Use ?month=YYYY-MM" },
      { status: 400 }
    );
  }

  const [yearStr, moStr] = month.split("-");
  const year = Number(yearStr);
  const monthIdx = parseInt(moStr, 10) - 1;

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

    const curGroups = buildGroupValues(rows, year);
    const pyGroups = buildGroupValues(rows, year - 1);
    const pyHasData = [...pyGroups.values()].some((arr) =>
      arr.slice(0, 12).some((v) => v !== 0)
    );

    const kpis = computeKPIs(curGroups, pyHasData ? pyGroups : null, monthIdx);
    const pnlByMonth = build13MonthPnL(
      curGroups,
      pyHasData ? pyGroups : null,
      month
    );

    return NextResponse.json({ kpis, pnlByMonth, selectedMonth: month, entityName });
  } catch (err: any) {
    console.error("Dashboard API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
