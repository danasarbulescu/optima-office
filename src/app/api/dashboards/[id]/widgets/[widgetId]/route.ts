import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { updateWidget, deleteWidget } from "@/lib/dashboard-widgets";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; widgetId: string }> },
) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  try {
    const { widgetId } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.config !== undefined) updates.config = body.config;

    await updateWidget(widgetId, updates);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Widget PUT error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; widgetId: string }> },
) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  try {
    const { widgetId } = await params;
    await deleteWidget(widgetId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Widget DELETE error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
