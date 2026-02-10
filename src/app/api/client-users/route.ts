import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getClientUsers, addClientUser } from "@/lib/client-users";
import { createCognitoUser } from "@/lib/cognito-admin";
import { setMembership } from "@/lib/client-membership";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isInternal) {
    return NextResponse.json({ error: "Forbidden: internal admin only" }, { status: 403 });
  }

  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  try {
    const clientUsers = await getClientUsers(clientId);
    return NextResponse.json({ clientUsers });
  } catch (err: any) {
    console.error("Client users GET error:", err);
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
    const { clientId, email, firstName, lastName, authorizedPackageIds } = body;

    if (!clientId || !email || !firstName || !lastName) {
      return NextResponse.json(
        { error: "clientId, email, firstName, and lastName are required" },
        { status: 400 },
      );
    }

    // 1. Create Cognito user (sends invite email)
    const cognitoUserId = await createCognitoUser(email, firstName, lastName);

    // 2. Create ClientUsers DynamoDB record
    const clientUser = await addClientUser({
      clientId,
      email,
      firstName,
      lastName,
      authorizedPackageIds: authorizedPackageIds || [],
      cognitoUserId,
    });

    // 3. Create ClientMembership record
    await setMembership(cognitoUserId, clientId, 'client-viewer', clientUser.id);

    return NextResponse.json({ success: true, id: clientUser.id }, { status: 201 });
  } catch (err: any) {
    console.error("Client users POST error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
