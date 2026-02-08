/**
 * Migrate existing data to multi-client model.
 *
 * 1. Creates a "Default" client in the Clients table
 * 2. Adds clientId to all existing Entity records (pointing to the default client)
 * 3. Creates internal-admin ClientMembership for each known Cognito user
 *
 * Usage:
 *   npx tsx scripts/migrate-to-clients.ts --entities-table TABLE --clients-table TABLE --memberships-table TABLE
 *
 * Or set env vars: ENTITIES_TABLE, CLIENTS_TABLE, CLIENT_MEMBERSHIPS_TABLE
 *
 * Add --dry-run to preview changes without writing.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

// Known admin users (from CLAUDE.md environments)
const KNOWN_USERS = [
  { id: "517bd500-b001-7058-f41c-f72bb5fc7040", label: "Win Desktop sandbox" },
  { id: "d1bbc5d0-3001-7080-d439-513d0557a5e0", label: "Win XPS sandbox" },
  { id: "b1eb05d0-2021-70ed-627a-9a99b4f566e3", label: "Production" },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      flags.dryRun = true;
    } else if (args[i].startsWith("--") && i + 1 < args.length) {
      const key = args[i].replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      flags[key] = args[++i];
    }
  }
  return flags;
}

async function main() {
  const flags = parseArgs();
  const dryRun = !!flags.dryRun;

  const entitiesTable = (flags.entitiesTable as string) || process.env.ENTITIES_TABLE || "";
  const clientsTable = (flags.clientsTable as string) || process.env.CLIENTS_TABLE || "";
  const membershipsTable = (flags.membershipsTable as string) || process.env.CLIENT_MEMBERSHIPS_TABLE || "";

  if (!entitiesTable || !clientsTable || !membershipsTable) {
    console.error("Error: All three table names are required.");
    console.error("  --entities-table or ENTITIES_TABLE");
    console.error("  --clients-table or CLIENTS_TABLE");
    console.error("  --memberships-table or CLIENT_MEMBERSHIPS_TABLE");
    process.exit(1);
  }

  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Entities table:    ${entitiesTable}`);
  console.log(`Clients table:     ${clientsTable}`);
  console.log(`Memberships table: ${membershipsTable}`);
  console.log();

  const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  // Step 1: Create default client
  const defaultClientId = randomUUID();
  console.log(`1. Creating default client (id: ${defaultClientId})...`);
  if (!dryRun) {
    await docClient.send(new PutCommand({
      TableName: clientsTable,
      Item: {
        id: defaultClientId,
        slug: "default",
        displayName: "Default",
        createdAt: new Date().toISOString(),
      },
    }));
  }
  console.log("   Done.");

  // Step 2: Patch all existing entities with clientId
  console.log("2. Scanning existing entities...");
  const scanResult = await docClient.send(new ScanCommand({
    TableName: entitiesTable,
  }));
  const entities = scanResult.Items || [];
  console.log(`   Found ${entities.length} entity(ies).`);

  let patched = 0;
  let skipped = 0;
  for (const entity of entities) {
    if (entity.clientId) {
      console.log(`   SKIP ${entity.id} (${entity.displayName}) — already has clientId: ${entity.clientId}`);
      skipped++;
      continue;
    }
    console.log(`   PATCH ${entity.id} (${entity.displayName}) → clientId: ${defaultClientId}`);
    if (!dryRun) {
      await docClient.send(new UpdateCommand({
        TableName: entitiesTable,
        Key: { id: entity.id },
        UpdateExpression: "SET clientId = :cid",
        ExpressionAttributeValues: { ":cid": defaultClientId },
      }));
    }
    patched++;
  }
  console.log(`   Patched: ${patched}, Skipped: ${skipped}`);

  // Step 3: Create internal-admin memberships
  console.log("3. Creating internal-admin memberships...");
  for (const user of KNOWN_USERS) {
    console.log(`   ${user.label}: ${user.id} → internal-admin (*)`);
    if (!dryRun) {
      await docClient.send(new PutCommand({
        TableName: membershipsTable,
        Item: {
          userId: user.id,
          clientId: "*",
          role: "internal-admin",
        },
      }));
    }
  }
  console.log("   Done.");

  console.log();
  console.log(dryRun ? "Dry run complete. Re-run without --dry-run to apply." : "Migration complete!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
