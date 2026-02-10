import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getClientUser, updateClientUser, deleteClientUser } from "@/lib/client-users";
import { disableCognitoUser, enableCognitoUser, deleteCognitoUser } from "@/lib/cognito-admin";
import { deleteMembership } from "@/lib/client-membership";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const clientUser = await getClientUser(id);
    if (!clientUser) {
      return NextResponse.json({ error: "Client user not found" }, { status: 404 });
    }
    return NextResponse.json({ clientUser });
  } catch (err: any) {
    console.error("Client user GET error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const clientUser = await getClientUser(id);
    if (!clientUser) {
      return NextResponse.json({ error: "Client user not found" }, { status: 404 });
    }

    const body = await request.json();
    const { firstName, lastName, status, authorizedPackageIds } = body;

    // Handle status changes: disable/enable Cognito user
    if (status !== undefined && status !== clientUser.status && clientUser.email) {
      if (status === 'archived') {
        await disableCognitoUser(clientUser.email);
      } else if (status === 'active') {
        await enableCognitoUser(clientUser.email);
      }
    }

    const updates: Record<string, unknown> = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (status !== undefined) updates.status = status;
    if (authorizedPackageIds !== undefined) updates.authorizedPackageIds = authorizedPackageIds;

    await updateClientUser(id, updates);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Client user PUT error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const clientUser = await getClientUser(id);
    if (!clientUser) {
      return NextResponse.json({ error: "Client user not found" }, { status: 404 });
    }

    // 1. Delete Cognito user
    if (clientUser.email) {
      try {
        await deleteCognitoUser(clientUser.email);
      } catch (err: any) {
        // User may already be deleted from Cognito — log but continue
        console.warn("Cognito delete warning:", err.message);
      }
    }

    // 2. Delete ClientMembership record
    if (clientUser.cognitoUserId) {
      try {
        await deleteMembership(clientUser.cognitoUserId);
      } catch (err: any) {
        console.warn("Membership delete warning:", err.message);
      }
    }

    // 3. Delete ClientUsers record
    await deleteClientUser(id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Client user DELETE error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
