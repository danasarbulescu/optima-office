import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { resolveDashboard } from "@/lib/dashboards";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const packageSlug = request.nextUrl.searchParams.get("packageSlug");
  const dashboardSlug = request.nextUrl.searchParams.get("dashboardSlug");
  const clientId = request.nextUrl.searchParams.get("clientId") || auth.clientId;

  if (!packageSlug || !dashboardSlug) {
    return NextResponse.json({ error: "packageSlug and dashboardSlug are required" }, { status: 400 });
  }

  if (!auth.isInternal && clientId !== auth.clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const dashboard = await resolveDashboard(clientId, packageSlug, dashboardSlug);
    if (!dashboard) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }
    return NextResponse.json({ dashboard });
  } catch (err: any) {
    console.error("Dashboard resolve error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
