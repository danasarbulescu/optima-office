import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { updateDashboard, deleteDashboard } from "@/lib/dashboards";
import { deleteWidgetsByDashboard } from "@/lib/dashboard-widgets";

export async function PUT(
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
    const { id } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.displayName !== undefined) updates.displayName = body.displayName;
    if (body.slug !== undefined) {
      if (!/^[a-z0-9-]+$/.test(body.slug)) {
        return NextResponse.json({ error: "slug must contain only lowercase letters, numbers, and hyphens" }, { status: 400 });
      }
      updates.slug = body.slug;
    }
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

    await updateDashboard(id, updates);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Dashboard PUT error:", err);
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
    const { id } = await params;
    // Cascade: delete all widgets in this dashboard
    await deleteWidgetsByDashboard(id);
    await deleteDashboard(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Dashboard DELETE error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
