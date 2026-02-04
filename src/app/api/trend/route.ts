import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { runWithAmplifyServerContext } from "@/utils/amplify-utils";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { fetchPLSummaries } from "@/lib/cdata";
import { buildExpensesTrend } from "@/lib/compute";
import { getCachedPL, setCachedPL } from "@/lib/cache";
import { CDataPLRow } from "@/lib/types";

export async function GET(request: NextRequest) {
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

  const companyId = process.env.CDATA_CATALOG ?? "";
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  try {
    let plRows: CDataPLRow[] | undefined;

    if (!refresh) {
      try {
        const cached = await getCachedPL(companyId);
        if (cached) plRows = cached.plRows;
      } catch (err) {
        console.error("Cache read failed, falling back to CData:", err);
      }
    }

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

    const data = buildExpensesTrend(plRows, startMonth, endMonth);

    return NextResponse.json({
      data,
      clientName: companyId,
    });
  } catch (err: any) {
    console.error("Trend API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
