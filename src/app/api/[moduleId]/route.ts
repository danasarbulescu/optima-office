import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getModuleManifest } from "@/modules/registry";
import { getClient } from "@/lib/clients";
import type { ModuleApiHandler } from "@/modules/types";

import { handleGet as dashboardGet } from "@/modules/dashboard/api";
import { handleGet as trendGet } from "@/modules/trend-analysis/api";

const handlers: Record<string, { GET?: ModuleApiHandler }> = {
  dashboard: { GET: dashboardGet },
  "trend-analysis": { GET: trendGet },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params;

  if (!getModuleManifest(moduleId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Module enablement check for non-internal users
  if (!auth.isInternal) {
    const client = await getClient(auth.clientId);
    if (!client?.enabledModules?.includes(moduleId)) {
      return NextResponse.json({ error: "Module not available" }, { status: 403 });
    }
  }

  const handler = handlers[moduleId]?.GET;
  if (!handler) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  return handler(request, auth);
}
