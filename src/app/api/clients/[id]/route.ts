import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getClient, updateClient, deleteClient } from "@/lib/clients";
import { getClientUsers, getClientUser, deleteClientUser } from "@/lib/client-users";
import { deleteCognitoUser } from "@/lib/cognito-admin";
import { deleteMembership, getMembershipsByClient } from "@/lib/client-membership";
import { getEntities, deleteEntity } from "@/lib/entities";
import { getPackages, deletePackage } from "@/lib/packages";
import { getDashboards, deleteDashboard } from "@/lib/dashboards";
import { deleteWidgetsByDashboard } from "@/lib/dashboard-widgets";

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
    const client = await getClient(id);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    return NextResponse.json({ client });
  } catch (err: any) {
    console.error("Client GET error:", err);
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
    const body = await request.json();
    const { displayName, firstName, lastName, email, status } = body;

    const updates: Record<string, unknown> = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) updates.email = email;
    if (status !== undefined) updates.status = status;

    await updateClient(id, updates);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Client PUT error:", err);
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

    // 1. Cascade delete client users (Cognito + membership + record)
    const clientUsers = await getClientUsers(id);
    for (const cu of clientUsers) {
      if (cu.email) {
        try { await deleteCognitoUser(cu.email); } catch (err: any) {
          console.warn("Cognito delete warning:", err.message);
        }
      }
      if (cu.cognitoUserId) {
        try { await deleteMembership(cu.cognitoUserId); } catch (err: any) {
          console.warn("Membership delete warning:", err.message);
        }
      }
      await deleteClientUser(cu.id);
    }

    // 1b. Sweep any remaining memberships referencing this client
    const remainingMemberships = await getMembershipsByClient(id);
    for (const m of remainingMemberships) {
      try { await deleteMembership(m.userId); } catch (err: any) {
        console.warn("Membership sweep warning:", err.message);
      }
    }

    // 2. Cascade delete entities (+ warehouse data)
    const entities = await getEntities(id);
    await Promise.all(entities.map(e => deleteEntity(e.id)));

    // 3. Cascade delete packages → dashboards → widgets
    const packages = await getPackages(id);
    for (const pkg of packages) {
      const dashboards = await getDashboards(pkg.id);
      for (const d of dashboards) {
        await deleteWidgetsByDashboard(d.id);
        await deleteDashboard(d.id);
      }
      await deletePackage(pkg.id);
    }

    // 4. Delete client record
    await deleteClient(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Client DELETE error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
