# QuickBooks Export

Web dashboard that fetches P&L data from CData Connect Cloud and renders financial dashboards for multiple QuickBooks entities. Supports per-entity and combined views. Deployed on AWS Amplify with Cognito authentication and DynamoDB caching.

## Domain Model

- **Client**: An accounting firm's client (e.g., "ACME Corp"). One client can have many entities.
- **Entity**: A QuickBooks company within a client (e.g., "Brooklyn Restaurants"). Entities contain the actual financial data.
- **Hierarchy**: Client (1) → Entity (many) → Dashboard data

## Workflows

- ***Web app***: `npm run dev` — local Next.js dev server (requires `npx ampx sandbox` running for backend)
- **Build**: `npm run build` — Next.js production build to `.next/`

## Project structure

```
amplify/
  auth/resource.ts                  — Cognito auth (email, no self-signup)
  backend.ts                        — defineBackend (auth + DynamoDB tables + SSR compute role)
src/
  app/
    layout.tsx                      — Root layout with ConfigureAmplify
    page.tsx                        — Home redirector (auth check)
    globals.css                     — Global styles (header, multi-select dropdown, controls)
    login/page.tsx                  — Login page with Authenticator
    (authed)/
      layout.tsx                    — Protected layout (header, entity multi-select, client switcher, nav, sign out)
      loading.tsx                   — Loading skeleton for page transitions
      entities/
        page.tsx                    — Entity management: list, add, edit, delete, sortable columns
        entities.css                — Entities page styles
      dashboard/
        page.tsx                    — Dashboard: month picker, refresh, render
        dashboard.css               — Dashboard-specific styles
      trend-analysis/
        page.tsx                    — Trend analysis: date range picker, lazy-loads TrendChart
        TrendChart.tsx              — Client-side recharts line chart (dynamic import, SSR disabled)
        trend-analysis.css          — Trend-specific styles
      tools/
        page.tsx                    — Sandbox data sync tool (preview + execute)
        tools.css                   — Tools page styles
    api/
      entities/route.ts             — API: list entities (GET), add entity (POST)
      entities/[id]/route.ts        — API: edit entity (PUT), delete entity (DELETE)
      clients/route.ts              — API: list clients (GET), add client (POST) — internal admin only
      clients/[id]/route.ts         — API: edit client (PUT), delete client (DELETE) — internal admin only
      auth/context/route.ts         — API: get current user's auth context (GET)
      dashboard/route.ts            — API: P&L fetch + compute + JSON (?month, ?entities)
      trend/route.ts                — API: expenses trend data (?startMonth, ?endMonth, ?entities)
      tools/sync-sandbox/route.ts   — API: sandbox sync preview + execute (POST)
  components/
    ConfigureAmplify.tsx            — Client component for Amplify SSR config
  context/
    ClientContext.tsx                — React context for client (multi-tenant) state + client switcher
    EntityContext.tsx                — React context for multi-select entity state + dynamic entity list
  utils/
    amplify-utils.ts                — Server-side Amplify runner
  lib/
    types.ts                        — Shared interfaces (EntityConfig, Client, ClientMembership, AuthContext, KPIs, PnLByMonth, CDataPLRow, PLCacheEntry)
    entities.ts                     — DynamoDB CRUD for Entities table (getEntities, addEntity, updateEntity, deleteEntity)
    clients.ts                      — DynamoDB CRUD for Clients table (getClients, getClient, addClient, updateClient, deleteClient)
    client-membership.ts            — DynamoDB access for ClientMemberships table (getMembershipForUser, setMembership)
    auth-context.ts                 — Auth context helper: resolves user session → clientId, role, isInternal
    cdata.ts                        — CData API client (parameterized credentials)
    cache.ts                        — DynamoDB P&L cache (getCachedPL, setCachedPL, 24h staleness)
    dynamo.ts                       — DynamoDB document client + pagination helpers (scanAllItems, queryAllItems)
    fetch-pl.ts                     — Shared fetch helper (cache-first, multi-entity merge)
    merge.ts                        — mergePLRows: sums numeric columns by RowGroup across entities
    compute.ts                      — buildGroupValues, computeKPIs, build13MonthPnL, buildExpensesTrend
    format.ts                       — formatAbbrev, formatPct, formatVariance
    html.ts                         — generateHTML, generatePnLTableHTML
    sandboxes.ts                    — Sandbox configs (Win Desktop, Win XPS, Production) with table prefixes
    sync-sandbox.ts                 — Cross-sandbox DynamoDB sync (previewSync, executeSync)
scripts/
  check-deployments.ts              — Poll Amplify deployment status (--watch for continuous polling)
  add-client.ts                     — CLI for creating clients and assigning user memberships
  migrate-to-clients.ts             — Migration script: creates default client, patches entities, assigns admin roles
next.config.ts                      — Inlines CData env vars at build time
tsconfig.json                       — Main TS config (esnext module, bundler resolution)
amplify.yml                         — Amplify CI/CD pipeline (backend deploy + frontend build)
.env.example                        — Env var template (CDATA_USER, CDATA_PAT, CDATA_CATALOG)
```

## Environment

- **Runtime**: Node.js + Next.js (frontend + API routes)
- **Language**: TypeScript (strict mode, ES2020 target)
- **Frontend**: React 18 + Next.js 15 (App Router) + @aws-amplify/ui-react
- **Backend**: AWS Amplify Gen 2 (Cognito auth + DynamoDB + SSR compute role)
- **Key dependencies**: axios, aws-amplify, @aws-amplify/adapter-nextjs, @aws-amplify/ui-react, @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, recharts, next, react
- **Web app config**: CData credentials set as Amplify hosting environment variables (or `.env.local` for local dev)

## Multi-tenant architecture

- **Client**: An accounting firm's client. Stored in the `Clients` DynamoDB table (id, slug, displayName, createdAt).
- **Client membership**: Maps Cognito users to clients. Stored in `ClientMemberships` table (userId → clientId, role).
- **Roles**: `internal-admin` (sees all clients, can switch between them), `client-admin`, `client-viewer` (locked to their client).
- **Auth context**: `src/lib/auth-context.ts` resolves the current user's session into `{ userId, clientId, role, isInternal }`.
- **Internal users**: See a client switcher dropdown in the header. Can switch between clients.
- **External users**: Locked to their assigned client. No switcher visible.
- **Routing**: Auth-based (URLs stay `/dashboard`, `/entities` — no client ID in URL). Client selection via `x-client-id` header or stored in context.
- **React context**: `ClientProvider` / `useClient()` in `src/context/ClientContext.tsx` provides `currentClientId`, `isInternal`, `setCurrentClientId`, `clients` (for internal users).

## Entity management

- **Entities table**: DynamoDB `Entities` table stores entity registry (id, catalogId, displayName, email?, firstName?, lastName?, clientId, createdAt)
- **GSI**: `byClient` index on `clientId` — used to query entities belonging to a specific client
- **ID model**: Internal UUID (`id`) is auto-generated; `catalogId` is the CData catalog name (e.g. `BrooklynRestaurants`)
- **CRUD**: `src/lib/entities.ts` provides `getEntities(clientId?)`, `addEntity(clientId, entity)`, `updateEntity()`, `deleteEntity()`
- **Entities page**: `/entities` — list with sortable columns (displayName, catalogId, email, firstName, lastName), add/edit modals, delete
- **API routes**: `GET/POST /api/entities`, `PUT/DELETE /api/entities/:id`
- **Env var**: `ENTITIES_TABLE` — DynamoDB table name (set in Amplify env vars or `.env.local`)

## Multi-entity support

- **Entity selector**: Multi-select checkbox dropdown in header (select one, multiple, or all entities)
- **Multi-select merge**: When multiple entities selected, fetches each in parallel, merges P&L rows by RowGroup (sums all numeric columns). Output is structurally identical to single-entity data so all compute functions work unchanged.
- **React context**: `EntityProvider` / `useEntity()` in `src/context/EntityContext.tsx` provides `entities`, `entitiesLoading`, `selectedEntities`, `setSelectedEntities`, `refreshEntities`
- **Auto-refetch**: Both dashboard and trend pages auto-refetch when selection changes; auto-fetch on mount uses cached data

## DynamoDB caching (`src/lib/cache.ts`)

- **Table**: PLCache (defined in `amplify/backend.ts`, provisioned via Amplify sandbox/pipeline)
- **Key**: `entityId` (partition key) — stores composite key `{clientId}#{entityId}`
- **Staleness**: 24-hour TTL — serves cached data if fresher than 24h, otherwise re-fetches from CData
- **Pattern**: Cache-first read, fire-and-forget write (via `src/lib/fetch-pl.ts`)
- **Combined mode**: Each entity cached individually; combined view does parallel cache lookups then in-memory merge
- **Env var**: `PL_CACHE_TABLE` — DynamoDB table name (set in Amplify env vars or `.env.local`)

## CData integration (`src/lib/cdata.ts`)

- **Endpoint**: `POST https://cloud.cdata.com/api/query` with Basic Auth (username + PAT)
- **SQL query**: `SELECT * FROM {catalog}.QuickBooksOnline.PL WHERE RowType = 'Summary' AND RowId IS NULL`
- **Table format**: `{catalog}.{schema}.{table}` (e.g. `BrooklynRestaurants.QuickBooksOnline.PL`)
- **PL table columns**: `account`, `RowGroup`, `RowType`, `RowId`, monthly columns (`Jan_2024` through `Dec_2026`), `Total`
- **RowGroups**: Income, COGS, GrossProfit, Expenses, NetOperatingIncome, OtherIncome, OtherExpenses, NetOtherIncome, NetIncome
- `buildGroupValues(rows, year)` — extracts monthly values for a given year into `Map<string, number[]>` (indices 0-11 = Jan-Dec, 12 = computed total)

## Dashboard

The dashboard is a self-contained HTML template with inline CSS:
- **9 KPI cards** in 2 rows: Revenue, Gross Margin, Net Income, YTD/YOY comparisons
- **13-month P&L table**: trailing window relative to selected month

Key functions in `src/lib/`:
- `computeKPIs(curGroups, pyGroups, monthIdx)` — derives all dashboard metrics
- `build13MonthPnL(curGroups, pyGroups, selectedMonth)` — builds 13-month trailing P&L data
- `generateHTML(kpis, selectedMonth, pnlByMonth, entityName?)` — renders the full dashboard HTML

## Trend Analysis

Line chart (recharts) showing operating expenses over a configurable date range:
- **X-axis**: months, **Y-axis**: dollar amounts
- **Two lines**: Total expenses per month + 13-month rolling average
- `buildExpensesTrend(plRows, startMonth, endMonth)` in `src/lib/compute.ts`
- `TrendChart.tsx` is a separate client component loaded via `next/dynamic` with SSR disabled (recharts requires browser APIs)

## Tools — Sandbox Data Sync

Admin tool at `/tools` for copying the Entities DynamoDB table between environments:
- **Sandboxes**: Defined in `src/lib/sandboxes.ts` — Win Desktop, Win XPS, Production (each with a table prefix)
- **Discovery**: `discoverEntitiesTable(prefix)` in `src/lib/sync-sandbox.ts` uses `ListTablesCommand` to find Entities tables by prefix
- **Preview**: Shows source/destination item counts and source items before sync
- **Execute**: Clears destination table, batch-writes all source items
- **API**: `POST /api/tools/sync-sandbox` with `{ action, sourceId, destinationId }`
- **IAM**: SSR compute role needs `dynamodb:ListTables` on `*` and read/write on `arn:aws:dynamodb:*:*:table/amplify-*`

## API

- **Entities**: `GET /api/entities` — list entities for current client; `POST /api/entities` — add entity `{ catalogId, displayName, email?, firstName?, lastName? }`; `PUT /api/entities/:id` — edit entity; `DELETE /api/entities/:id` — remove entity
- **Clients**: `GET /api/clients` — list all clients (internal admin only); `POST /api/clients` — add client `{ slug, displayName }`; `PUT /api/clients/:id` — edit client; `DELETE /api/clients/:id` — remove client
- **Auth context**: `GET /api/auth/context` — returns current user's auth context (clientId, role, isInternal, clients list)
- **Dashboard**: `GET /api/dashboard?month=YYYY-MM&entities=id1,id2&refresh=true` — P&L KPIs and 13-month table data
- **Trend**: `GET /api/trend?startMonth=YYYY-MM&endMonth=YYYY-MM&entities=id1,id2&refresh=true` — monthly expenses trend data
- **Sandbox sync**: `POST /api/tools/sync-sandbox` — `{ action: "preview"|"execute", sourceId, destinationId }` — preview or execute DynamoDB Entities table sync between sandboxes
- All endpoints: cookie-based Cognito auth via Amplify SSR
- `?entities` accepts comma-separated entity IDs (validated against Entities table)
- `?refresh=true` bypasses DynamoDB cache and fetches fresh from CData
- **Response (dashboard)**: `{ kpis, pnlByMonth, selectedMonth, entityName }`
- **Response (trend)**: `{ data: TrendDataPoint[], entityName }`
- Frontend calls `generateHTML()` client-side with dashboard JSON response

## npm scripts

- `npm run dev` — Next.js dev server
- `npm run build` — Next.js production build (uses `.next/`, will disrupt running dev server)
- `npm run build:check` — production build to `.next-build/` (safe to run alongside dev server)
- `npm run start` — Next.js production server

## CI/CD (`amplify.yml`)

- **Backend**: `npm ci` then `npx ampx pipeline-deploy` (deploys Cognito + DynamoDB resources per branch)
- **Frontend**: `npm ci` then `npm run build`, artifacts from `.next/`
- **Caches**: `.next/cache`, `node_modules`, `.npm`

## Build-time env inlining (`next.config.ts`)

CData credentials (`CDATA_USER`, `CDATA_PAT`, `CDATA_CATALOG`) are inlined into the Next.js bundle via `next.config.ts` `env` property. `PL_CACHE_TABLE`, `ENTITIES_TABLE`, `CLIENTS_TABLE`, and `CLIENT_MEMBERSHIPS_TABLE` are also inlined for DynamoDB access. On Amplify hosting these are set as environment variables in the Amplify console. For local dev, use `.env.local`.

## Local development

```bash
# Terminal 1: Deploy sandbox backend
npx ampx sandbox

# Terminal 2: Start frontend
npm run dev
```

Create `.env.local` with `CDATA_USER`, `CDATA_PAT`, `CDATA_CATALOG`, `PL_CACHE_TABLE`, `ENTITIES_TABLE`, `CLIENTS_TABLE`, `CLIENT_MEMBERSHIPS_TABLE`.

## Deployment

- Push to `main` branch deploys to `d149ycglubuqvd.amplifyapp.com` (production)
- Amplify Hosting handles CI/CD automatically
- **Check deployment status**: `npx tsx scripts/check-deployments.ts` (add `--watch` to poll until complete)
- **Automatic monitoring**: A `PostToolUse` hook in `.claude/settings.local.json` detects `git push` and instructs Claude to run the watch script in the background. Claude must NOT block on the result -- instead, note the task ID and check non-blockingly (`TaskOutput block=false`) at the start of subsequent responses. Only report when the deployment has completed (SUCCEED or FAILED) -- do not mention it while still running

### Environments

**Win Desktop sandbox**
- AWS resource prefix: `amplify-quickbooksexport-marin-sandbox-59a22a3c9b`
- User Pool Id: `us-east-2_erjhdlOkq`
- User id: `517bd500-b001-7058-f41c-f72bb5fc7040`
- User admin email: `dana.sarbulescu@gmail.com`

**Win XPS sandbox**
- AWS resource prefix: `amplify-quickbooksexport-Marin-sandbox-a3c0c362ac`
- User Pool Id: `us-east-2_TAqqsNbL6`
- User id: `d1bbc5d0-3001-7080-d439-513d0557a5e0`
- User admin email: `dana.sarbulescu@gmail.com`

**Production**
- AWS resource prefix: `amplify-d149ycglubuqvd-main-branch-d0cdc27b71`
- User Pool Id: `us-east-2_IqqSQubzw`
- User id: `b1eb05d0-2021-70ed-627a-9a99b4f566e3`
- User admin email: `dana.sarbulescu@gmail.com`

<!-- Last deployment test: 2026-02-07 -->
