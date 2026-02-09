import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getPackages, addPackage } from "@/lib/packages";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clientId = request.nextUrl.searchParams.get("clientId") || auth.clientId;
    if (!auth.isInternal && clientId !== auth.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const packages = await getPackages(clientId);
    return NextResponse.json({ packages });
  } catch (err: any) {
    console.error("Packages GET error:", err);
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
    const { clientId, slug, displayName, sortOrder } = body;

    if (!clientId || !slug || !displayName) {
      return NextResponse.json({ error: "clientId, slug, and displayName are required" }, { status: 400 });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: "slug must contain only lowercase letters, numbers, and hyphens" }, { status: 400 });
    }

    const pkg = await addPackage({ clientId, slug, displayName, sortOrder: sortOrder ?? 0 });
    return NextResponse.json({ success: true, id: pkg.id }, { status: 201 });
  } catch (err: any) {
    console.error("Packages POST error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
