import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { runWithAmplifyServerContext } from "@/utils/amplify-utils";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { deleteClient, updateClient } from "@/lib/clients";

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { catalogId, displayName, email, firstName, lastName } = body;

    if (catalogId !== undefined && !/^[a-zA-Z0-9_]+$/.test(catalogId)) {
      return NextResponse.json({ error: "catalogId must contain only letters, numbers, and underscores" }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    if (catalogId !== undefined) updates.catalogId = catalogId;
    if (displayName !== undefined) updates.displayName = displayName;
    if (email !== undefined) updates.email = email;
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;

    await updateClient(id, updates);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Client PUT error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAuth())) {
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
