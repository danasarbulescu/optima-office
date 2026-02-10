import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { deleteEntity, updateEntity } from "@/lib/entities";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { displayName, dataSourceBindings } = body;

    // Validate catalogId regex within each binding
    if (dataSourceBindings) {
      for (const binding of dataSourceBindings) {
        const catId = binding.sourceConfig?.catalogId;
        if (catId && !/^[a-zA-Z0-9_]+$/.test(catId)) {
          return NextResponse.json({ error: "Catalog ID must contain only letters, numbers, and underscores" }, { status: 400 });
        }
      }
    }

    const updates: Record<string, unknown> = {};
    if (displayName !== undefined) updates.displayName = displayName;

    if (dataSourceBindings !== undefined) {
      updates.dataSourceBindings = dataSourceBindings;
      // Sync legacy fields from first binding for backward compat
      if (dataSourceBindings.length > 0) {
        updates.dataSourceId = dataSourceBindings[0].dataSourceId;
        updates.sourceConfig = dataSourceBindings[0].sourceConfig;
        if (dataSourceBindings[0].sourceConfig?.catalogId) {
          updates.catalogId = dataSourceBindings[0].sourceConfig.catalogId;
        }
      } else {
        updates.dataSourceId = null;
        updates.sourceConfig = null;
        updates.catalogId = '';
      }
    }

    await updateEntity(id, updates);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Entity PUT error:", err);
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

  try {
    const { id } = await params;
    await deleteEntity(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Entity DELETE error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
