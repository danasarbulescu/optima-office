import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getEntities, addEntity } from "@/lib/entities";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Internal users with no specific client selected see all entities
    const clientId = auth.isInternal && auth.clientId === '*' ? undefined : auth.clientId;
    const entities = await getEntities(clientId);
    return NextResponse.json({ entities });
  } catch (err: any) {
    console.error("Entities GET error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.clientId === '*') {
    return NextResponse.json({ error: "Select a client before adding an entity" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { catalogId, displayName, email, firstName, lastName } = body;

    if (!catalogId || !displayName) {
      return NextResponse.json({ error: "catalogId and displayName are required" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(catalogId)) {
      return NextResponse.json({ error: "catalogId must contain only letters, numbers, and underscores" }, { status: 400 });
    }

    await addEntity(auth.clientId, { catalogId, displayName, email, firstName, lastName });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    console.error("Entities POST error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
