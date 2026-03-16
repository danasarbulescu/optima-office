import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getEntities } from "@/lib/entities";
import { getDataSource } from "@/lib/data-sources";
import { fetchFullPLRows } from "@/lib/cdata";

/**
 * GET /api/entities/[id]/accounts
 * Returns the distinct Income and COGS Data account names for an entity,
 * fetched live from CData. Used to populate the account category dropdowns
 * in the entity admin UI.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const clientId = auth.isInternal && auth.clientId === "*" ? undefined : auth.clientId;
    const entities = await getEntities(clientId);
    const entity = entities.find(e => e.id === id);
    if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 });

    let user = process.env.CDATA_USER ?? "";
    let pat  = process.env.CDATA_PAT  ?? "";
    const catalogId = entity.sourceConfig?.catalogId || entity.catalogId;

    if (entity.dataSourceId) {
      const ds = await getDataSource(entity.dataSourceId);
      if (ds && ds.status === "active") {
        user = ds.config.user || user;
        pat  = ds.config.pat  || pat;
      }
    }

    if (!catalogId) {
      return NextResponse.json({ error: "Entity has no data source configured" }, { status: 400 });
    }

    const rows = await fetchFullPLRows(user, pat, catalogId);

    const income = Array.from(new Set(
      rows
        .filter(r => r.RowGroup === "Income" && r.RowType === "Data")
        .map(r => ((r.account ?? "") as string).trim())
        .filter(Boolean)
    ));

    const cogs = Array.from(new Set(
      rows
        .filter(r => r.RowGroup === "COGS" && r.RowType === "Data")
        .map(r => ((r.account ?? "") as string).trim())
        .filter(Boolean)
    ));

    return NextResponse.json({ income, cogs });
  } catch (err: any) {
    console.error("Entity accounts API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
