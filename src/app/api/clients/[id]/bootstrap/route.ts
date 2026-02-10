import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getClient } from "@/lib/clients";
import { getEntities } from "@/lib/entities";
import { getPackages } from "@/lib/packages";
import { getDashboardsByClient } from "@/lib/dashboards";
import { getWidgets } from "@/lib/dashboard-widgets";
import { getClientUsers } from "@/lib/client-users";
import { getDataSources } from "@/lib/data-sources";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  try {
    const { id: clientId } = await params;

    // Single auth resolution, then fetch all client detail data in parallel
    const [client, entities, packages, dashboards, clientUsers, dataSources] = await Promise.all([
      getClient(clientId),
      getEntities(clientId),
      getPackages(clientId),
      getDashboardsByClient(clientId),
      getClientUsers(clientId),
      getDataSources(),
    ]);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch widgets for all dashboards in parallel
    const widgetEntries = await Promise.all(
      dashboards.map(async (d) => {
        const widgets = await getWidgets(d.id);
        return [d.id, widgets] as const;
      })
    );
    const widgetsByDashboard: Record<string, typeof widgetEntries[0][1]> = {};
    for (const [dashId, widgets] of widgetEntries) {
      widgetsByDashboard[dashId] = widgets;
    }

    return NextResponse.json({
      client,
      entities,
      packages,
      dashboards,
      widgetsByDashboard,
      clientUsers,
      dataSources,
    });
  } catch (err: any) {
    console.error("Client detail bootstrap error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
