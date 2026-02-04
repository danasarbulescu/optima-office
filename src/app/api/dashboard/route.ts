import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { runWithAmplifyServerContext } from "@/utils/amplify-utils";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { fetchPLSummaries } from "@/lib/cdata";
import { buildGroupValues, computeKPIs, build13MonthPnL } from "@/lib/compute";
import { getCachedPL, setCachedPL } from "@/lib/cache";
import { CDataPLRow } from "@/lib/types";

export async function GET(request: NextRequest) {
  // Validate authentication via Amplify server context
  const authenticated = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: async (contextSpec) => {
      try {
        const session = await fetchAuthSession(contextSpec);
        return !!session.tokens;
      } catch {
        return false;
      }
    },
  });

  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate month parameter
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

  const companyId = process.env.CDATA_CATALOG ?? "";
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  try {
    let plRows: CDataPLRow[] | undefined;

    // Try cache first (skip if manual refresh requested)
    if (!refresh) {
      try {
        const cached = await getCachedPL(companyId);
        if (cached) plRows = cached.plRows;
      } catch (err) {
        console.error("Cache read failed, falling back to CData:", err);
      }
    }

    // Cache miss or refresh: fetch from CData
    if (!plRows) {
      const freshRows = await fetchPLSummaries(
        process.env.CDATA_USER ?? "",
        process.env.CDATA_PAT ?? "",
        companyId
      );

      if (freshRows.length === 0) {
        return NextResponse.json(
          { error: "No P&L summary data returned from CData." },
          { status: 404 }
        );
      }

      setCachedPL(companyId, companyId, freshRows).catch((err) =>
        console.error("Cache write failed:", err)
      );
      plRows = freshRows;
    }

    const curGroups = buildGroupValues(plRows, year);
    const pyGroups = buildGroupValues(plRows, year - 1);
    const pyHasData = [...pyGroups.values()].some((arr) =>
      arr.slice(0, 12).some((v) => v !== 0)
    );

    const kpis = computeKPIs(curGroups, pyHasData ? pyGroups : null, monthIdx);
    const pnlByMonth = build13MonthPnL(
      curGroups,
      pyHasData ? pyGroups : null,
      month
    );

    return NextResponse.json({ kpis, pnlByMonth, selectedMonth: month, clientName: companyId });
  } catch (err: any) {
    console.error("Dashboard API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
