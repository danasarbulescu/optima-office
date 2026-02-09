import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getDashboards, getDashboardsByClient, addDashboard } from "@/lib/dashboards";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const packageId = request.nextUrl.searchParams.get("packageId");
    const clientId = request.nextUrl.searchParams.get("clientId") || auth.clientId;

    if (!auth.isInternal && clientId !== auth.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dashboards = packageId
      ? await getDashboards(packageId)
      : await getDashboardsByClient(clientId);
    return NextResponse.json({ dashboards });
  } catch (err: any) {
    console.error("Dashboards GET error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { packageId, clientId, slug, displayName, sortOrder, dataSourceType } = body;

    if (!packageId || !clientId || !slug || !displayName || !dataSourceType) {
      return NextResponse.json({ error: "packageId, clientId, slug, displayName, and dataSourceType are required" }, { status: 400 });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: "slug must contain only lowercase letters, numbers, and hyphens" }, { status: 400 });
    }

    const dashboard = await addDashboard({ packageId, clientId, slug, displayName, sortOrder: sortOrder ?? 0, dataSourceType });
    return NextResponse.json({ success: true, id: dashboard.id }, { status: 201 });
  } catch (err: any) {
    console.error("Dashboards POST error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
