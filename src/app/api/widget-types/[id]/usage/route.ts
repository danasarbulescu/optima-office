import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getWidgetType } from "@/widgets/registry";
import { getWidgetsByType } from "@/lib/dashboard-widgets";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/dynamo";
import { Dashboard, Package, Client } from "@/lib/types";

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

  const { id } = await params;
  const wt = getWidgetType(id);
  if (!wt) {
    return NextResponse.json({ error: "Widget type not found in registry" }, { status: 404 });
  }

  try {
    const widgets = await getWidgetsByType(id);
    if (widgets.length === 0) {
      return NextResponse.json({ usage: [] });
    }

    // Fetch dashboards for all widget instances
    const dashboardIds = [...new Set(widgets.map(w => w.dashboardId))];
    const dashboards = await Promise.all(
      dashboardIds.map(async (did) => {
        const res = await docClient.send(new GetCommand({
          TableName: process.env.DASHBOARDS_TABLE || '',
          Key: { id: did },
        }));
        return res.Item as Dashboard | undefined;
      })
    );
    const dashboardMap = new Map(dashboards.filter(Boolean).map(d => [d!.id, d!]));

    // Fetch packages and clients
    const packageIds = [...new Set(dashboards.filter(Boolean).map(d => d!.packageId))];
    const clientIds = [...new Set(dashboards.filter(Boolean).map(d => d!.clientId))];

    const [packages, clients] = await Promise.all([
      Promise.all(packageIds.map(async (pid) => {
        const res = await docClient.send(new GetCommand({
          TableName: process.env.PACKAGES_TABLE || '',
          Key: { id: pid },
        }));
        return res.Item as Package | undefined;
      })),
      Promise.all(clientIds.map(async (cid) => {
        const res = await docClient.send(new GetCommand({
          TableName: process.env.CLIENTS_TABLE || '',
          Key: { id: cid },
        }));
        return res.Item as Client | undefined;
      })),
    ]);

    const packageMap = new Map(packages.filter(Boolean).map(p => [p!.id, p!]));
    const clientMap = new Map(clients.filter(Boolean).map(c => [c!.id, c!]));

    // Assemble usage records
    const usage = widgets
      .map(w => {
        const dashboard = dashboardMap.get(w.dashboardId);
        if (!dashboard) return null;
        const pkg = packageMap.get(dashboard.packageId);
        const client = clientMap.get(dashboard.clientId);
        return {
          widgetId: w.id,
          sortOrder: w.sortOrder,
          dashboardId: dashboard.id,
          dashboardName: dashboard.displayName,
          packageId: dashboard.packageId,
          packageName: pkg?.displayName || 'Unknown',
          clientId: dashboard.clientId,
          clientName: client?.displayName || 'Unknown',
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const cmp = a!.clientName.localeCompare(b!.clientName);
        if (cmp !== 0) return cmp;
        const pCmp = a!.packageName.localeCompare(b!.packageName);
        if (pCmp !== 0) return pCmp;
        return a!.dashboardName.localeCompare(b!.dashboardName);
      });

    return NextResponse.json({ usage });
  } catch (err: any) {
    console.error("Widget type usage GET error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
