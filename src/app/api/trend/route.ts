import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { runWithAmplifyServerContext } from "@/utils/amplify-utils";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { buildExpensesTrend } from "@/lib/compute";
import { fetchPLForCompanies } from "@/lib/fetch-pl";
import { getClients } from "@/lib/clients";

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

    const data = buildExpensesTrend(plRows, startMonth, endMonth);

    return NextResponse.json({ data, clientName });
  } catch (err: any) {
    console.error("Trend API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
