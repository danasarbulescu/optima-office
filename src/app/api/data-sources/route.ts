import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getDataSources, addDataSource } from "@/lib/data-sources";
import { DATA_SOURCE_TYPES } from "@/lib/data-source-types";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  try {
    const dataSources = await getDataSources();
    dataSources.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return NextResponse.json({ dataSources });
  } catch (err: any) {
    console.error("Data sources GET error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, displayName, config } = body;

    if (!type || !displayName) {
      return NextResponse.json({ error: "type and displayName are required" }, { status: 400 });
    }

    if (!DATA_SOURCE_TYPES[type]) {
      return NextResponse.json({ error: `Unknown data source type: ${type}` }, { status: 400 });
    }

    const id = await addDataSource({ type, displayName, config: config || {} });
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (err: any) {
    console.error("Data sources POST error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
