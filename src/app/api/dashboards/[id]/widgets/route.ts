import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getWidgets, addWidget, deleteWidgetsByDashboard } from "@/lib/dashboard-widgets";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: dashboardId } = await params;
    const widgets = await getWidgets(dashboardId);
    return NextResponse.json({ widgets });
  } catch (err: any) {
    console.error("Widgets GET error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(
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
    const { id: dashboardId } = await params;
    const body = await request.json();
    const { widgetTypeId, sortOrder, config } = body;

    if (!widgetTypeId) {
      return NextResponse.json({ error: "widgetTypeId is required" }, { status: 400 });
    }

    const widget = await addWidget({
      dashboardId,
      widgetTypeId,
      sortOrder: sortOrder ?? 0,
      config,
    });
    return NextResponse.json({ success: true, id: widget.id }, { status: 201 });
  } catch (err: any) {
    console.error("Widgets POST error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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
    const { id: dashboardId } = await params;
    await deleteWidgetsByDashboard(dashboardId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Widgets DELETE error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
