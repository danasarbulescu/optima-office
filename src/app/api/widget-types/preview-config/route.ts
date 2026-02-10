import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { docClient } from "@/lib/dynamo";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.WIDGET_TYPE_META_TABLE || '';
const CONFIG_ID = '__preview-config__';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth || !auth.isInternal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!TABLE_NAME) {
    return NextResponse.json({ entityId: null });
  }

  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: CONFIG_ID },
  }));

  return NextResponse.json({
    entityId: result.Item?.previewEntityId || null,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthContext(request.headers.get("x-client-id"));
  if (!auth || !auth.isInternal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!TABLE_NAME) {
    return NextResponse.json({ error: "WIDGET_TYPE_META_TABLE not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { entityId } = body;

  if (!entityId) {
    return NextResponse.json({ error: "entityId is required" }, { status: 400 });
  }

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { id: CONFIG_ID, previewEntityId: entityId },
  }));

  return NextResponse.json({ success: true });
}
