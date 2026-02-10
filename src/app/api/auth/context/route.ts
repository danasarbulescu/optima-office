import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getClients, getClient } from "@/lib/clients";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // For internal users, also return the client list for the switcher
    if (auth.isInternal) {
      const clients = await getClients();
      return NextResponse.json({
        userId: auth.userId,
        clientId: auth.clientId,
        role: auth.role,
        isInternal: true,
        clients,
      });
    }

    // For external users, return their client info
    const client = await getClient(auth.clientId);
    return NextResponse.json({
      userId: auth.userId,
      clientId: auth.clientId,
      role: auth.role,
      isInternal: false,
      client,
      authorizedPackageIds: auth.authorizedPackageIds ?? null,
      authorizedDashboardIds: auth.authorizedDashboardIds ?? null,
    });
  } catch (err: any) {
    console.error("Auth context error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
