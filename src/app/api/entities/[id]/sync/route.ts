import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getEntities } from "@/lib/entities";
import { getDataSource } from "@/lib/data-sources";
import { fetchSingleEntity, syncClassData } from "@/lib/fetch-pl";

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

    // Resolve adapter type and credentials (same logic as fetchSingleEntity)
    let adapterType = 'quickbooks';
    let credentials: Record<string, string> = {
      user: process.env.CDATA_USER ?? '',
      pat: process.env.CDATA_PAT ?? '',
    };
    if (entity.dataSourceId) {
      const ds = await getDataSource(entity.dataSourceId);
      if (ds && ds.status === 'active') {
        adapterType = ds.type === 'cdata' ? 'quickbooks' : ds.type;
        credentials = ds.config;
      }
    }

    const rows = await fetchSingleEntity(
      cacheClientId,
      entity.id,
      sc,
      entity.displayName,
      true,
      entity.dataSourceId,
    );

    // Discover and store class-level P&L data (awaited so result is available in response)
    let discoveredClasses: { id: string; name: string; tableName: string }[] = [];
    try {
      await syncClassData(entity.id, sc, credentials, adapterType);
      // Read back the class index to include in response
      const { getWarehouseClassIndex } = await import('@/lib/warehouse');
      discoveredClasses = (await getWarehouseClassIndex(entity.id)) ?? [];
    } catch (err) {
      console.error(`Class sync failed for entity ${entity.id}:`, err);
    }

    return NextResponse.json({
      success: true,
      rowCount: rows.length,
      syncedAt: new Date().toISOString(),
      discoveredClasses,
    });
  } catch (err: any) {
    console.error("Entity sync error:", err);
    return NextResponse.json(
      { error: err.message || "Sync failed" },
      { status: 500 },
    );
  }
}
