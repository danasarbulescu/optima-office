import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { runWithAmplifyServerContext } from "@/utils/amplify-utils";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { getClients, addClient } from "@/lib/clients";

async function checkAuth(): Promise<boolean> {
  return runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: async (contextSpec) => {
      try {
        const session = await fetchAuthSession(contextSpec);
        return !!session.tokens;
      } catch {
        return false;
      }
    },
  });
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    await addClient({ catalogId, displayName, email, firstName, lastName });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    console.error("Clients POST error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
