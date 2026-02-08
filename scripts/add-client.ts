/**
 * CLI for managing clients and memberships.
 *
 * Usage:
 *   # Create a client
 *   npx tsx scripts/add-client.ts create --slug acme --name "ACME Corp"
 *
 *   # List clients
 *   npx tsx scripts/add-client.ts list
 *
 *   # Assign a user to a client
 *   npx tsx scripts/add-client.ts assign --user-id <cognito-sub> --client-id <id> --role client-admin
 *
 *   # Assign a user as internal admin (all clients)
 *   npx tsx scripts/add-client.ts assign --user-id <cognito-sub> --role internal-admin
 *
 * Table names come from env vars (CLIENTS_TABLE, CLIENT_MEMBERSHIPS_TABLE)
 * or flags (--clients-table, --memberships-table).
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const flags: Record<string, string> = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      const key = args[i].replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      flags[key] = args[++i];
    }
  }
  return { command, flags };
}

async function main() {
  const { command, flags } = parseArgs();
  const clientsTable = flags.clientsTable || process.env.CLIENTS_TABLE || "";
  const membershipsTable = flags.membershipsTable || process.env.CLIENT_MEMBERSHIPS_TABLE || "";

  const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  switch (command) {
    case "create": {
      if (!clientsTable) {
        console.error("Error: CLIENTS_TABLE env var or --clients-table required");
        process.exit(1);
      }
      const slug = flags.slug;
      const displayName = flags.name;
      if (!slug || !displayName) {
        console.error("Usage: create --slug <slug> --name <display-name>");
        process.exit(1);
      }
      if (!/^[a-z0-9-]+$/.test(slug)) {
        console.error("Error: slug must be lowercase letters, numbers, and hyphens only");
        process.exit(1);
      }

      const id = randomUUID();
      await docClient.send(new PutCommand({
        TableName: clientsTable,
        Item: {
          id,
          slug,
          displayName,
          createdAt: new Date().toISOString(),
        },
      }));
      console.log(`Created client: ${displayName} (${slug})`);
      console.log(`  id: ${id}`);
      break;
    }

    case "list": {
      if (!clientsTable) {
        console.error("Error: CLIENTS_TABLE env var or --clients-table required");
        process.exit(1);
      }
      const result = await docClient.send(new ScanCommand({ TableName: clientsTable }));
      const clients = result.Items || [];
      if (clients.length === 0) {
        console.log("No clients found.");
      } else {
        console.log(`Found ${clients.length} client(s):\n`);
        for (const c of clients) {
          console.log(`  ${c.displayName} (${c.slug})`);
          console.log(`    id: ${c.id}`);
          console.log(`    created: ${c.createdAt}`);
          console.log();
        }
      }
      break;
    }

    case "assign": {
      if (!membershipsTable) {
        console.error("Error: CLIENT_MEMBERSHIPS_TABLE env var or --memberships-table required");
        process.exit(1);
      }
      const userId = flags.userId;
      const role = flags.role;
      if (!userId || !role) {
        console.error("Usage: assign --user-id <cognito-sub> --client-id <id> --role <role>");
        console.error("Roles: internal-admin, client-admin, client-viewer");
        process.exit(1);
      }

      const validRoles = ["internal-admin", "client-admin", "client-viewer"];
      if (!validRoles.includes(role)) {
        console.error(`Error: role must be one of: ${validRoles.join(", ")}`);
        process.exit(1);
      }

      const clientId = role === "internal-admin" ? "*" : flags.clientId;
      if (!clientId) {
        console.error("Error: --client-id is required for non-internal roles");
        process.exit(1);
      }

      await docClient.send(new PutCommand({
        TableName: membershipsTable,
        Item: { userId, clientId, role },
      }));
      console.log(`Assigned user ${userId} → ${role} (client: ${clientId})`);
      break;
    }

    default:
      console.error("Usage: add-client.ts <create|list|assign> [options]");
      console.error();
      console.error("Commands:");
      console.error("  create  --slug <slug> --name <name>     Create a client");
      console.error("  list                                     List all clients");
      console.error("  assign  --user-id <id> --role <role>     Assign a user membership");
      console.error("          [--client-id <id>]               (required for non-internal roles)");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
