import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getDataSource, updateDataSource, deleteDataSource } from "@/lib/data-sources";
import { getEntities } from "@/lib/entities";
import { getEntityBindings } from "@/lib/types";

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
    const { id } = await params;
    const dataSource = await getDataSource(id);
    if (!dataSource) {
      return NextResponse.json({ error: "Data source not found" }, { status: 404 });
    }
    return NextResponse.json({ dataSource });
  } catch (err: any) {
    console.error("Data source GET error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
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

  try {
    const { id } = await params;
    const body = await request.json();
    const { displayName, config, status } = body;

    const updates: Record<string, unknown> = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (config !== undefined) updates.config = config;
    if (status !== undefined) updates.status = status;

    await updateDataSource(id, updates);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Data source PUT error:", err);
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

    // Check if any entities reference this data source (in any binding)
    const allEntities = await getEntities();
    const bound = allEntities.filter(e =>
      getEntityBindings(e).some(b => b.dataSourceId === id)
    );
    if (bound.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${bound.length} entit${bound.length === 1 ? 'y' : 'ies'} still reference this data source` },
        { status: 409 },
      );
    }

    await deleteDataSource(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Data source DELETE error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
