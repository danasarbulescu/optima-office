import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getEntities } from "@/lib/entities";
import { fetchSingleEntity } from "@/lib/fetch-pl";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth || !auth.isInternal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const entities = await getEntities();
    const entity = entities.find(e => e.id === id);
    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const sc = entity.sourceConfig || { catalogId: entity.catalogId };
    const cacheClientId = entity.clientId || 'global';
    const rows = await fetchSingleEntity(
      cacheClientId,
      entity.id,
      sc,
      entity.displayName,
      true,
      entity.dataSourceId,
    );

    return NextResponse.json({ success: true, rowCount: rows.length });
  } catch (err: any) {
    console.error("Entity sync error:", err);
    return NextResponse.json(
      { error: err.message || "Sync failed" },
      { status: 500 },
    );
  }
}
