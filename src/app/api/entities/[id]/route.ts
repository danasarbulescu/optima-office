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
    const { displayName, dataSourceId, sourceConfig } = body;

    // Support sourceConfig.catalogId or legacy top-level catalogId
    const catalogId = sourceConfig?.catalogId || body.catalogId;
    if (catalogId !== undefined && catalogId && !/^[a-zA-Z0-9_]+$/.test(catalogId)) {
      return NextResponse.json({ error: "Catalog ID must contain only letters, numbers, and underscores" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (sourceConfig !== undefined) {
      updates.sourceConfig = sourceConfig;
      if (sourceConfig.catalogId) updates.catalogId = sourceConfig.catalogId;
    } else if (catalogId !== undefined) {
      updates.catalogId = catalogId;
    }
    if (displayName !== undefined) updates.displayName = displayName;
    if (dataSourceId !== undefined) updates.dataSourceId = dataSourceId || null;

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
