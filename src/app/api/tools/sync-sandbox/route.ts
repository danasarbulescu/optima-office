import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getSandboxById } from "@/lib/sandboxes";
import { previewSync, executeSync } from "@/lib/sync-sandbox";

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sandbox sync is internal-admin only
  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { sourceId, destinationId, preview } = body;

    if (!sourceId || !destinationId) {
      return NextResponse.json({ error: "sourceId and destinationId are required" }, { status: 400 });
    }

    if (sourceId === destinationId) {
      return NextResponse.json({ error: "Source and destination must be different" }, { status: 400 });
    }

    const source = getSandboxById(sourceId);
    const destination = getSandboxById(destinationId);

    if (!source || !destination) {
      return NextResponse.json({ error: "Invalid sandbox ID" }, { status: 400 });
    }

    if (preview) {
      const result = await previewSync(source, destination);
      return NextResponse.json({ preview: true, ...result });
    }

    const report = await executeSync(source, destination);
    return NextResponse.json({ preview: false, report });
  } catch (err: any) {
    console.error("Sync sandbox error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
