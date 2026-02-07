import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { runWithAmplifyServerContext } from "@/utils/amplify-utils";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { deleteClient } from "@/lib/clients";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authenticated = await runWithAmplifyServerContext({
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

  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await deleteClient(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Client DELETE error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
