import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getClients, getClient } from "@/lib/clients";
import { getPackages } from "@/lib/packages";
import { getDashboardsByClient } from "@/lib/dashboards";
import { getWidgets } from "@/lib/dashboard-widgets";
import { getEntities } from "@/lib/entities";
import type { DashboardWidget } from "@/lib/types";

export async function GET(request: NextRequest) {
  const selectedClientId = request.nextUrl.searchParams.get("clientId");
  const auth = await getAuthContext(selectedClientId || request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Resolve effective clientId for data queries
    const clientId = auth.clientId;
    const dataClientId = clientId === '*' ? undefined : clientId;

    // Fetch all layout data in parallel (single auth resolution)
    const [clients, client, packages, dashboards, entities] = await Promise.all([
      auth.isInternal ? getClients() : Promise.resolve([]),
      !auth.isInternal ? getClient(clientId) : Promise.resolve(null),
      dataClientId ? getPackages(dataClientId) : Promise.resolve([]),
      dataClientId ? getDashboardsByClient(dataClientId) : Promise.resolve([]),
      getEntities(dataClientId),
    ]);

    // Phase 2: fetch widgets for all dashboards in parallel
    const widgetsByDashboard: Record<string, DashboardWidget[]> = {};
    if (dashboards.length > 0) {
      const widgetResults = await Promise.all(
        dashboards.map(d => getWidgets(d.id))
      );
      dashboards.forEach((d, i) => {
        if (widgetResults[i].length > 0) {
          widgetsByDashboard[d.id] = widgetResults[i];
        }
      });
    }

    return NextResponse.json({
      auth: {
        userId: auth.userId,
        clientId: auth.clientId,
        role: auth.role,
        isInternal: auth.isInternal,
        authorizedPackageIds: auth.authorizedPackageIds,
        authorizedDashboardIds: auth.authorizedDashboardIds,
      },
      clients,
      client,
      packages,
      dashboards,
      entities,
      widgetsByDashboard,
    });
  } catch (err: any) {
    console.error("Bootstrap error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
