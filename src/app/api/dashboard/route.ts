import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { runWithAmplifyServerContext } from "@/utils/amplify-utils";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { buildGroupValues, computeKPIs, build13MonthPnL } from "@/lib/compute";
import { fetchPLForCompanies } from "@/lib/fetch-pl";
import { getClients } from "@/lib/clients";

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

  const companiesParam = request.nextUrl.searchParams.get("companies");
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  if (!companiesParam) {
    return NextResponse.json({ error: "Missing companies parameter" }, { status: 400 });
  }

  const companyIds = companiesParam.split(",").filter(Boolean);
  if (companyIds.length === 0) {
    return NextResponse.json({ error: "No companies specified" }, { status: 400 });
  }

  try {
    const clients = await getClients();
    const validIds = new Set(clients.map(c => c.id));
    const invalid = companyIds.filter(id => !validIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid company IDs: ${invalid.join(", ")}` }, { status: 400 });
    }

    const { plRows, clientName } = await fetchPLForCompanies(companyIds, clients, refresh);

    if (plRows.length === 0) {
      return NextResponse.json(
        { error: "No P&L summary data returned from CData." },
        { status: 404 }
      );
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

    return NextResponse.json({ kpis, pnlByMonth, selectedMonth: month, clientName });
  } catch (err: any) {
    console.error("Dashboard API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
