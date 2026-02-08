import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getClients, addClient } from "@/lib/clients";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  try {
    const clients = await getClients();
    return NextResponse.json({ clients });
  } catch (err: any) {
    console.error("Clients GET error:", err);
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
    const { slug, displayName, firstName, lastName, email, enabledModules } = body;

    if (!slug || !displayName) {
      return NextResponse.json({ error: "slug and displayName are required" }, { status: 400 });
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: "slug must contain only lowercase letters, numbers, and hyphens" }, { status: 400 });
    }

    if (enabledModules !== undefined && !Array.isArray(enabledModules)) {
      return NextResponse.json({ error: "enabledModules must be an array" }, { status: 400 });
    }

    const id = await addClient({ slug, displayName, firstName, lastName, email, enabledModules });
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (err: any) {
    console.error("Clients POST error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
