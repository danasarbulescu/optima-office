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
    const { catalogId, displayName } = body;

    if (catalogId !== undefined && !/^[a-zA-Z0-9_]+$/.test(catalogId)) {
      return NextResponse.json({ error: "catalogId must contain only letters, numbers, and underscores" }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    if (catalogId !== undefined) updates.catalogId = catalogId;
    if (displayName !== undefined) updates.displayName = displayName;

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
