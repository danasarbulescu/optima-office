import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getWidgetType } from "@/widgets/registry";
import { getWidgetTypeMeta, upsertWidgetTypeMeta, deleteWidgetTypeMeta } from "@/lib/widget-type-meta";

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

  const override = await getWidgetTypeMeta(id);
  const widgetType = {
    ...wt,
    originalName: wt.name,
    name: override?.displayName || wt.name,
    description: override?.description || "",
    hasOverride: !!override,
  };

  return NextResponse.json({ widgetType });
}

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

  const { id } = await params;
  const wt = getWidgetType(id);
  if (!wt) {
    return NextResponse.json({ error: "Widget type not found in registry" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { displayName, description } = body;

    // If only resetting name (no description provided) and name is empty, delete the record
    if ((!displayName || !displayName.trim()) && description === undefined) {
      await deleteWidgetTypeMeta(id);
      return NextResponse.json({ success: true, reset: true });
    }

    const fields: { displayName?: string; description?: string } = {};
    if (displayName !== undefined) {
      fields.displayName = displayName.trim() || undefined;
    }
    if (description !== undefined) {
      fields.description = description;
    }

    await upsertWidgetTypeMeta(id, fields);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("WidgetTypeMeta PUT error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
