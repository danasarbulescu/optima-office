# QuickBooks Export

Web dashboard that fetches P&L data from CData Connect Cloud and renders financial dashboards for multiple QuickBooks companies. Supports per-company and combined views. Deployed on AWS Amplify with Cognito authentication and DynamoDB caching.

## Workflows

- **Web app**: `npm run dev` — local Next.js dev server (requires `npx ampx sandbox` running for backend)
- **Build**: `npm run build` — Next.js production build to `.next/`

## Project structure

```
amplify/
  auth/resource.ts                  — Cognito auth (email, no self-signup)
  backend.ts                        — defineBackend (auth + DynamoDB PLCache + Clients tables)
src/
  app/
    layout.tsx                      — Root layout with ConfigureAmplify
    page.tsx                        — Home redirector (auth check)
    globals.css                     — Global styles (header, multi-select dropdown, controls)
    login/page.tsx                  — Login page with Authenticator
    (authed)/
      layout.tsx                    — Protected layout (header, multi-select dropdown, nav, sign out)
      clients/
        page.tsx                    — Client management: list, add (modal), delete
        clients.css                 — Clients page styles
      dashboard/
        page.tsx                    — Dashboard: month picker, refresh, render
        dashboard.css               — Dashboard-specific styles
      trend-analysis/
        page.tsx                    — Trend analysis: date range, line chart (recharts)
        trend-analysis.css          — Trend-specific styles
    api/
      clients/route.ts              — API: list clients (GET), add client (POST)
      clients/[id]/route.ts         — API: delete client (DELETE)
      dashboard/route.ts            — API: P&L fetch + compute + JSON (?month, ?companies)
      trend/route.ts                — API: expenses trend data (?startMonth, ?endMonth, ?companies)
  components/
    ConfigureAmplify.tsx            — Client component for Amplify SSR config
  context/
    CompanyContext.tsx               — React context for multi-select company state + dynamic client list
  utils/
    amplify-utils.ts                — Server-side Amplify runner
  lib/
    types.ts                        — Shared interfaces (ClientConfig, KPIs, PnLByMonth, CDataPLRow, PLCacheEntry)
    clients.ts                      — DynamoDB CRUD for Clients table (getClients, addClient, deleteClient)
    cdata.ts                        — CData API client (parameterized credentials)
    cache.ts                        — DynamoDB P&L cache (getCachedPL, setCachedPL, 24h staleness)
    fetch-pl.ts                     — Shared fetch helper (cache-first, multi-company merge)
    merge.ts                        — mergePLRows: sums numeric columns by RowGroup across companies
    compute.ts                      — buildGroupValues, computeKPIs, build13MonthPnL, buildExpensesTrend
    format.ts                       — formatAbbrev, formatPct, formatVariance
    html.ts                         — generateHTML, generatePnLTableHTML
next.config.ts                      — Inlines CData env vars at build time
tsconfig.json                       — Main TS config (esnext module, bundler resolution)
amplify.yml                         — Amplify CI/CD pipeline (backend deploy + frontend build)
.env.example                        — Env var template (CDATA_USER, CDATA_PAT, CDATA_CATALOG)
```

## Environment

- **Runtime**: Node.js + Next.js (frontend + API routes)
- **Language**: TypeScript (strict mode, ES2020 target)
- **Frontend**: React 18 + Next.js 15 (App Router) + @aws-amplify/ui-react
- **Backend**: AWS Amplify Gen 2 (Cognito auth + DynamoDB)
- **Key dependencies**: axios, aws-amplify, @aws-amplify/adapter-nextjs, @aws-amplify/ui-react, @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, recharts, next, react
- **Web app config**: CData credentials set as Amplify hosting environment variables (or `.env.local` for local dev)

## Client management

- **Clients table**: DynamoDB `Clients` table stores client registry (id, displayName, createdAt)
- **CRUD**: `src/lib/clients.ts` provides `getClients()`, `addClient()`, `deleteClient()`
- **Clients page**: `/clients` — list, add (modal with display name + CData catalog ID), delete
- **API routes**: `GET/POST /api/clients`, `DELETE /api/clients/:id`
- **Env var**: `CLIENTS_TABLE` — DynamoDB table name (set in Amplify env vars or `.env.local`)

## Multi-company support

- **Client selector**: Multi-select checkbox dropdown in header (select one, multiple, or all clients)
- **Multi-select merge**: When multiple clients selected, fetches each in parallel, merges P&L rows by RowGroup (sums all numeric columns). Output is structurally identical to single-company data so all compute functions work unchanged.
- **React context**: `CompanyProvider` / `useCompany()` in `src/context/CompanyContext.tsx` provides `clients`, `selectedCompanies`, `setSelectedCompanies`, `refreshClients`
- **Auto-refetch**: Both dashboard and trend pages auto-refetch when selection changes; auto-fetch on mount uses cached data

## DynamoDB caching (`src/lib/cache.ts`)

- **Table**: PLCache (defined in `amplify/backend.ts`, provisioned via Amplify sandbox/pipeline)
- **Key**: `companyId` (partition key)
- **Staleness**: 24-hour TTL — serves cached data if fresher than 24h, otherwise re-fetches from CData
- **Pattern**: Cache-first read, fire-and-forget write (via `src/lib/fetch-pl.ts`)
- **Combined mode**: Each company cached individually; combined view does parallel cache lookups then in-memory merge
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
- `generateHTML(kpis, selectedMonth, pnlByMonth, clientName?)` — renders the full dashboard HTML

## Trend Analysis

Line chart (recharts) showing operating expenses over a configurable date range:
- **X-axis**: months, **Y-axis**: dollar amounts
- **Two lines**: Total expenses per month + 13-month rolling average
- `buildExpensesTrend(plRows, startMonth, endMonth)` in `src/lib/compute.ts`

## API

- **Clients**: `GET /api/clients` — list all clients; `POST /api/clients` — add client `{ id, displayName }`; `DELETE /api/clients/:id` — remove client
- **Dashboard**: `GET /api/dashboard?month=YYYY-MM&companies=id1,id2&refresh=true` — P&L KPIs and 13-month table data
- **Trend**: `GET /api/trend?startMonth=YYYY-MM&endMonth=YYYY-MM&companies=id1,id2&refresh=true` — monthly expenses trend data
- All endpoints: cookie-based Cognito auth via Amplify SSR
- `?companies` accepts comma-separated client IDs (validated against Clients table)
- `?refresh=true` bypasses DynamoDB cache and fetches fresh from CData
- **Response (dashboard)**: `{ kpis, pnlByMonth, selectedMonth, clientName }`
- **Response (trend)**: `{ data: TrendDataPoint[], clientName }`
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

CData credentials (`CDATA_USER`, `CDATA_PAT`, `CDATA_CATALOG`) are inlined into the Next.js bundle via `next.config.ts` `env` property. `PL_CACHE_TABLE` and `CLIENTS_TABLE` are also inlined for DynamoDB access. On Amplify hosting these are set as environment variables in the Amplify console. For local dev, use `.env.local`.

## Local development

```bash
# Terminal 1: Deploy sandbox backend
npx ampx sandbox

# Terminal 2: Start frontend
npm run dev
```

Create `.env.local` with `CDATA_USER`, `CDATA_PAT`, `CDATA_CATALOG`, `PL_CACHE_TABLE`, `CLIENTS_TABLE`.

## Deployment

- Push to `main` branch deploys to `d149ycglubuqvd.amplifyapp.com` (production)
- Amplify Hosting handles CI/CD automatically
- **Check deployment status**: `npx tsx scripts/check-deployments.ts` (add `--watch` to poll until complete)
- **Automatic monitoring**: A `PostToolUse` hook in `.claude/settings.local.json` detects `git push` and instructs Claude to run the watch script in the background. Claude must NOT block on the result -- instead, note the task ID and check non-blockingly (`TaskOutput block=false`) at the start of subsequent responses. Only report when the deployment has completed (SUCCEED or FAILED) -- do not mention it while still running

### Environments

**Win Desktop sandbox**
- User Pool Id: `us-east-2_erjhdlOkq`
- User id: `517bd500-b001-7058-f41c-f72bb5fc7040`
- User admin email: `dana.sarbulescu@gmail.com`

**Win XPS sandbox**
- AWS resource prefix: `amplify-quickbooksexport-Marin-sandbox-a3c0c362ac`
- User Pool Id: `us-east-2_TAqqsNbL6`
- User id: `d1bbc5d0-3001-7080-d439-513d0557a5e0`
- User admin email: `dana.sarbulescu@gmail.com`

**Production**
- User Pool Id: `us-east-2_IqqSQubzw`
- User id: `b1eb05d0-2021-70ed-627a-9a99b4f566e3`
- User admin email: `dana.sarbulescu@gmail.com`

<!-- Last deployment test: 2026-02-03 -->
