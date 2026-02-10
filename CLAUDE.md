# QuickBooks Export

Web dashboard that fetches P&L data from CData Connect Cloud and renders financial dashboards for multiple QuickBooks entities. Supports per-entity and combined views. Deployed on AWS Amplify with Cognito authentication and DynamoDB caching. Dashboards are fully data-driven: admins configure packages, dashboards, and widgets per client via the UI.

## Domain Model

- **Client**: An accounting firm's client (e.g., "ACME Corp"). One client can have many entities and packages.
- **Entity**: A QuickBooks company within a client (e.g., "Brooklyn Restaurants"). Entities contain the actual financial data.
- **Package**: A grouping of dashboards for a client (e.g., "Financial Reports"). Packages appear as nav items.
- **Dashboard**: A page within a package (e.g., "Monthly Dashboard"). Contains an ordered list of widgets.
- **Widget**: An instance of a widget type placed on a dashboard. Has a type, sort order, and optional config.
- **Widget Type**: A reusable component definition (e.g., "Revenue Current Month" KPI card). Defined in code, display names overridable via DynamoDB.
- **Client User**: A sub-account within a client with restricted package access (e.g., a client employee who can only see certain reports). Managed by internal admins; auto-creates a Cognito login with email invite.
- **Data Source**: A configured external data connection (e.g., a CData Connect Cloud account). Global (not per-client). Entities optionally bind to a data source for credentials; unbound entities fall back to global env vars.
- **Hierarchy**: Client (1) → Entity (many) + Package (many) → Dashboard (many) → Widget (many). Client (1) → Client User (many) → authorized Packages (many). Entity (many) → Data Source (0..many).

## Workflows

- ***Web app***: `npm run dev` — local Next.js dev server (requires `npx ampx sandbox` running for backend)
- **Build**: `npm run build` — Next.js production build to `.next/`

## Project structure

```
amplify/
  auth/resource.ts                  — Cognito auth (email, no self-signup)
  backend.ts                        — defineBackend (auth + 10 DynamoDB tables + SSR compute role + Cognito admin IAM)
src/
  app/
    layout.tsx                      — Root layout with ConfigureAmplify
    page.tsx                        — Home redirector (auth check)
    globals.css                     — Global styles (header, multi-select dropdown, controls, package nav)
    login/page.tsx                  — Login page with Authenticator
    (authed)/
      layout.tsx                    — Protected layout (header, PackageNav, client switcher, entity selector, sign out)
      loading.tsx                   — Loading skeleton for page transitions
      [packageSlug]/
        page.tsx                    — Package index: redirects to first dashboard in the package
        [dashboardSlug]/page.tsx    — Dashboard page: resolves dashboard by slugs, fetches widgets, renders widget-driven content
      clients/
        page.tsx                    — Client list: sortable table, add/archive/delete clients
        [id]/page.tsx               — Client detail: entities, client users, packages, dashboards, widgets CRUD
        [id]/modals.tsx             — CRUD modals: EditClient, Add/EditEntity, Add/EditPackage, Add/EditDashboard, AddWidget, Add/EditClientUser
        [id]/PackageAccordion.tsx   — Nested accordion for Package → Dashboard → Widget hierarchy
        clients.css                 — Clients page styles
      data-sources/
        page.tsx                    — Data sources admin: list, add, edit, delete data sources (internal admin only)
        data-sources.css            — Data sources page styles
      widgets/
        page.tsx                    — Widget types admin: list all widget types (clickable), rename (DynamoDB override)
        [id]/page.tsx               — Widget type detail: info, KPI config, usage table (which dashboards use it)
        EditWidgetTypeModal.tsx     — Shared rename modal (used by list + detail pages)
        widgets.css                 — Widgets page + detail page styles
      tools/
        page.tsx                    — Sandbox data sync tool (preview + execute)
        tools.css                   — Tools page styles
    api/
      data-sources/route.ts         — API: list data sources (GET), add data source (POST) — internal admin only
      data-sources/[id]/route.ts    — API: get (GET), edit (PUT), delete with entity ref check (DELETE) — internal admin only
      entities/route.ts             — API: list entities (GET), add entity (POST)
      entities/[id]/route.ts        — API: edit entity (PUT), delete entity (DELETE)
      clients/route.ts              — API: list clients (GET), add client (POST) — internal admin only
      clients/[id]/route.ts         — API: edit client (PUT), delete client (DELETE) — internal admin only
      client-users/route.ts         — API: list client users (GET), create + Cognito invite (POST) — internal admin only
      client-users/[id]/route.ts    — API: get (GET), update + Cognito enable/disable (PUT), delete + cascade (DELETE)
      packages/route.ts             — API: list packages (GET), add package (POST) — internal admin only
      packages/[id]/route.ts        — API: edit package (PUT), delete package + cascade (DELETE)
      dashboards/route.ts           — API: list dashboards (GET), add dashboard (POST)
      dashboards/resolve/route.ts   — API: resolve dashboard by packageSlug + dashboardSlug (GET)
      dashboards/[id]/route.ts      — API: edit dashboard (PUT), delete dashboard + cascade (DELETE)
      dashboards/[id]/widgets/route.ts       — API: list widgets (GET), add widget (POST)
      dashboards/[id]/widgets/[widgetId]/route.ts — API: edit widget (PUT), delete widget (DELETE)
      widget-types/route.ts         — API: list all widget types with DynamoDB name overrides (GET)
      widget-types/[id]/route.ts    — API: get widget type detail (GET), rename or reset to default (PUT)
      widget-types/[id]/usage/route.ts — API: get dashboards using this widget type (GET)
      widget-data/
        financial-snapshot/route.ts — API: KPIs + P&L table data (GET)
        expense-trend/route.ts      — API: expense trend chart data (GET)
      auth/context/route.ts         — API: get current user's auth context + authorizedPackageIds (GET)
      tools/sync-sandbox/route.ts   — API: sandbox sync preview + execute (POST)
  widgets/
    types.ts                        — WidgetType interface { id, name, category, component }
    registry.ts                     — Static widget type catalog (WIDGET_TYPES array, getWidgetType)
    kpi-config.ts                   — KpiWidgetConfig per widget type ID: headers, KPI field, format, variance
    widgets.css                     — Widget component styles (cards, grid, P&L table, trend chart)
    components/
      KpiCard.tsx                   — KPI card component: renders value, variance, label from KPIs data
      PnlTable.tsx                  — P&L table component: 13-month trailing table with row definitions
      TrendChart.tsx                — Trend chart component: recharts line chart (expenses + 13-month avg)
components/
    ConfigureAmplify.tsx            — Client component for Amplify SSR config
  context/
    ClientContext.tsx                — React context: client state, client switcher, impersonation, authorizedPackageIds
    EntityContext.tsx                — React context: multi-select entity state, dynamic entity list
    PackageContext.tsx               — React context: packages + dashboards for current client (filtered by authorizedPackageIds)
  utils/
    amplify-utils.ts                — Server-side Amplify runner
  lib/
    types.ts                        — Shared interfaces (EntityConfig, Client, ClientUser, DataSource, AuthContext, Package, Dashboard, DashboardWidget, WidgetTypeMeta, KPIs, PnLByMonth, PLCacheEntry)
    models/financial.ts             — Source-agnostic financial types (FinancialRow, FinancialDataSet)
    adapters/
      base.ts                       — DataAdapter interface (generic sourceConfig + credentials)
      quickbooks.ts                 — QuickBooksAdapter: normalizes CData rows to FinancialRow
      index.ts                      — Adapter registry (getAdapter)
    data-source-types.ts            — Data source type registry (connection fields + entity fields per type, e.g. CData)
    data-sources.ts                 — DynamoDB CRUD for DataSources table (getDataSources, getDataSource, addDataSource, updateDataSource, deleteDataSource)
    entities.ts                     — DynamoDB CRUD for Entities table
    clients.ts                      — DynamoDB CRUD for Clients table
    client-membership.ts            — DynamoDB CRUD for ClientMemberships table (getMembership, setMembership, deleteMembership)
    client-users.ts                 — DynamoDB CRUD for ClientUsers table (getClientUsers, getClientUser, addClientUser, updateClientUser, deleteClientUser)
    cognito-admin.ts                — Cognito admin operations (createCognitoUser, disableCognitoUser, enableCognitoUser, deleteCognitoUser)
    packages.ts                     — DynamoDB CRUD for Packages table (getPackages, getPackageBySlug, addPackage, updatePackage, deletePackage)
    dashboards.ts                   — DynamoDB CRUD for Dashboards table (getDashboards, getDashboardsByClient, getDashboardBySlug, resolveDashboard, addDashboard, updateDashboard, deleteDashboard)
    dashboard-widgets.ts            — DynamoDB CRUD for DashboardWidgets table (getWidgets, getWidgetsByType, addWidget, updateWidget, deleteWidget, deleteWidgetsByDashboard)
    widget-type-meta.ts             — DynamoDB CRUD for WidgetTypeMeta table (getAllWidgetTypeMeta, getWidgetTypeMeta, upsertWidgetTypeMeta, deleteWidgetTypeMeta)
    auth-context.ts                 — Auth context helper: resolves user session → clientId, role, isInternal, authorizedPackageIds
    cdata.ts                        — CData API client (fetchPLSummaries, CDataPLRow type)
    cache.ts                        — DynamoDB P&L cache (getCachedPL, setCachedPL, 24h staleness)
    dynamo.ts                       — DynamoDB document client + pagination helpers (scanAllItems, queryAllItems)
    fetch-pl.ts                     — Shared fetch helper (cache-first, adapter-based, per-entity data source credentials, multi-entity merge)
    merge.ts                        — mergeFinancialRows: sums period values by category across entities
    compute.ts                      — buildGroupValues, computeKPIs, build13MonthPnL, buildExpensesTrend
    format.ts                       — formatAbbrev, formatPct, formatVariance
    sandboxes.ts                    — Sandbox configs (Win Desktop, Win XPS, Production) with table prefixes
    sync-sandbox.ts                 — Cross-sandbox DynamoDB sync (previewSync, executeSync)
scripts/
  check-deployments.ts              — Poll Amplify deployment status (--watch for continuous polling)
  add-client.ts                     — CLI for creating clients and assigning user memberships
  migrate-to-clients.ts             — Migration script: creates default client, patches entities, assigns admin roles
next.config.ts                      — Inlines env vars (CData creds + 10 DynamoDB table names + Cognito User Pool ID) at build time
tsconfig.json                       — Main TS config (esnext module, bundler resolution)
amplify.yml                         — Amplify CI/CD pipeline (backend deploy + frontend build)
.env.example                        — Env var template (CDATA_USER, CDATA_PAT, CDATA_CATALOG)
```

## Environment

- **Runtime**: Node.js + Next.js (frontend + API routes)
- **Language**: TypeScript (strict mode, ES2020 target)
- **Frontend**: React 18 + Next.js 15 (App Router) + @aws-amplify/ui-react
- **Backend**: AWS Amplify Gen 2 (Cognito auth + DynamoDB + SSR compute role)
- **Key dependencies**: axios, aws-amplify, @aws-amplify/adapter-nextjs, @aws-amplify/ui-react, @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, @aws-sdk/client-cognito-identity-provider, recharts, next, react
- **Web app config**: CData credentials set as Amplify hosting environment variables (or `.env.local` for local dev)

## Multi-tenant architecture

- **Client**: An accounting firm's client. Stored in the `Clients` DynamoDB table (id, slug, displayName, firstName?, lastName?, email?, createdAt, status?).
- **Client membership**: Maps Cognito users to clients. Stored in `ClientMemberships` table (userId → clientId, role, clientUserId?).
- **Roles**: `internal-admin` (sees all clients, can switch between them), `client-admin`, `client-viewer` (locked to their client).
- **Client users**: Sub-accounts within a client with restricted package access. Stored in `ClientUsers` table (id, clientId, email, firstName, lastName, status, authorizedPackageIds, cognitoUserId). Created by internal admins; auto-creates Cognito user + sends email invite. Linked to `ClientMemberships` via `clientUserId`.
- **Auth context**: `src/lib/auth-context.ts` resolves the current user's session into `{ userId, clientId, role, isInternal, authorizedPackageIds }`. For client users, `authorizedPackageIds` is resolved from the linked `ClientUser` record. `null` = full access; `string[]` = restricted to those packages. Archived client users are denied access (returns null).
- **Internal users**: See a client switcher dropdown in the header. Can switch between clients. See all packages/dashboards + admin pages (Clients, Widgets, Tools).
- **External users**: Locked to their assigned client. No switcher visible. See only their client's packages and dashboards.
- **Routing**: Auth-based. Dashboard URLs use `/{packageSlug}/{dashboardSlug}` pattern. Client selection via `x-client-id` header or stored in context.
- **React context**: `ClientProvider` / `useClient()` in `src/context/ClientContext.tsx` provides `currentClientId`, `isInternal`, `setCurrentClientId`, `clients`, `isImpersonating`, `startImpersonating()`, `stopImpersonating()`, `authorizedPackageIds`.
- **Client impersonation**: Internal admins can click "View as Client" (when a specific client is selected) to see exactly what that client sees — only their packages/dashboards, no admin nav (Clients/Widgets/Tools), no client switcher. An amber banner shows "Viewing as {clientName}" with an Exit button. Purely client-side; auto-clears when switching clients.

## Package / Dashboard / Widget system

The display layer is fully data-driven. Admins configure what each client sees via packages, dashboards, and widgets — all stored in DynamoDB.

### Hierarchy

- **Package** → groups dashboards (e.g., "Financial Reports"). Per-client, has slug + sortOrder.
- **Dashboard** → a page within a package (e.g., "Monthly Dashboard"). Per-package, has slug + sortOrder.
- **DashboardWidget** → a widget instance on a dashboard. References a widget type by ID, has sortOrder + optional config.
- **WidgetType** → a reusable component defined in code (`src/widgets/registry.ts`). Not per-client.

### Widget types (static registry)

Defined in `src/widgets/registry.ts` as `WIDGET_TYPES` array. Each has `{ id, name, category, component }`:

**KPI Cards** (component: `KpiCard`):
- `kpi-revenue-current-mo`, `kpi-revenue-3mo-avg`, `kpi-ytd-revenue`, `kpi-py-revenue`
- `kpi-gross-margin-current-mo`, `kpi-gross-margin-ytd`
- `kpi-net-income-current-mo`, `kpi-net-income-ytd`, `kpi-py-net-income`

**Table** (component: `PnlTable`):
- `pnl-table-13mo` — 13-month trailing P&L table

**Chart** (component: `TrendChart`):
- `trend-chart-expenses` — Operating expenses trend line chart

### KPI configuration (`src/widgets/kpi-config.ts`)

Maps each KPI widget type ID to `KpiWidgetConfig { headerLine1, headerLine2, field, format, varianceField?, variancePctField?, varianceLabel?, nullable? }`. The `field` key references a property on the `KPIs` interface.

### Widget components (`src/widgets/components/`)

- **KpiCard**: Renders a KPI value with optional variance. Uses `formatAbbrev` / `formatPct`.
- **PnlTable**: Renders a 13-month trailing P&L table with row definitions (Revenue, COGS, Gross Profit, GP%, Expenses, Net Operating Income, etc.).
- **TrendChart**: Recharts line chart showing monthly expenses + 13-month rolling average. Loaded via `next/dynamic` with SSR disabled.

### Widget type name overrides

Admins can rename widget types via `/widgets` page. Overrides stored in `WidgetTypeMeta` DynamoDB table. The `/api/widget-types` GET endpoint merges static registry names with DynamoDB overrides.

### Navigation

`PackageNav` component in the authed layout renders navigation from packages/dashboards:
- Packages with a single dashboard render as a direct link: `/{packageSlug}/{dashboardSlug}`
- Packages with multiple dashboards render as a dropdown menu
- Internal admins also see Clients, Data Sources, Widgets, Tools links (hidden during impersonation)

### Dashboard page rendering (`src/app/(authed)/[packageSlug]/[dashboardSlug]/page.tsx`)

1. Resolves dashboard from URL slugs via `/api/dashboards/resolve`
2. Fetches the dashboard's widgets via `/api/dashboards/:id/widgets`
3. Infers data needs from widget types (financial snapshot vs. trend)
4. Fetches data from `/api/widget-data/financial-snapshot` and/or `/api/widget-data/expense-trend`
5. Renders widget components: KPI cards in a grid, P&L table, and/or trend chart
6. Provides month picker + refresh controls based on which widget types are present

### DynamoDB tables

| Table | Partition Key | GSIs | Env Var |
|-------|-------------|------|---------|
| Packages | `id` | `byClient` (clientId) | `PACKAGES_TABLE` |
| Dashboards | `id` | `byPackage` (packageId), `byClient` (clientId) | `DASHBOARDS_TABLE` |
| DashboardWidgets | `id` | `byDashboard` (dashboardId) | `DASHBOARD_WIDGETS_TABLE` |
| WidgetTypeMeta | `id` | — | `WIDGET_TYPE_META_TABLE` |
| ClientUsers | `id` | `byClient` (clientId) | `CLIENT_USERS_TABLE` |
| DataSources | `id` | — | `DATA_SOURCES_TABLE` |

### Cascade deletes

- Delete package → deletes all dashboards in the package → deletes all widgets in those dashboards
- Delete dashboard → deletes all widgets in the dashboard
- Delete client → deletes all client users (Cognito + membership + record) → deletes all entities (client detail page handles this)
- Delete client user → deletes Cognito user → deletes ClientMembership → deletes ClientUser record

### React context

`PackageProvider` / `usePackages()` in `src/context/PackageContext.tsx` provides `packages`, `dashboardsByPackage`, `packagesLoading`, `refreshPackages`. Fetches packages and dashboards for the current client, re-fetches when client changes. Filters by `authorizedPackageIds` from `ClientContext` — client users only see their authorized packages and dashboards.

## Client & entity management

- **Clients list page**: `/clients` — sortable table (displayName, slug), click through to client detail. Client CRUD with contact fields (firstName, lastName, email) and status (active/archived). Archived clients hidden from main list; "Archived (N)" button opens modal to reactivate. "Remove All" button for bulk delete.
- **Client detail page**: `/clients/:id` — full management for a single client:
  - **Client info panel**: display name, slug, status, contact fields (firstName, lastName, email). Edit/Delete buttons.
  - **Entities section**: table with displayName, data source(s). Add/Edit/Delete entity CRUD. Entities support multiple data source bindings — each binding has a data source dropdown + dynamic entity-level fields. Entity modals render stacked binding sections with Add/Remove buttons. Table shows first DS name + "(+N more)" for additional bindings.
  - **Client Users section**: table with name, email, status badge, # packages. Add (creates Cognito + sends invite) / Edit (name, status, packages) / Delete (cascades Cognito + membership). Package authorization via checkboxes in modals.
  - **Packages section**: nested accordion tables. Package → Dashboards → Widgets. Full CRUD at each level with modal forms. Auto-slug generation from display names.
- **Entities table**: DynamoDB `Entities` table stores entity registry (id, catalogId, displayName, clientId, dataSourceBindings?, dataSourceId?, sourceConfig?, createdAt)
- **GSI**: `byClient` index on `clientId` — used to query entities belonging to a specific client
- **ID model**: Internal UUID (`id`) is auto-generated; `catalogId` is kept as a top-level field for backward compat
- **dataSourceBindings**: `DataSourceBinding[]` — array of `{ dataSourceId, sourceConfig }` for multi-data-source support. Legacy fields `dataSourceId` and `sourceConfig` are synced from `bindings[0]` on write for backward compat. `getEntityBindings(entity)` in `src/lib/types.ts` normalizes old and new formats into an array.
- **CRUD**: `src/lib/entities.ts` provides `getEntities(clientId?)`, `addEntity(clientId, { displayName, dataSourceBindings? })`, `updateEntity()`, `deleteEntity()`
- **API routes**: `GET/POST /api/entities`, `PUT/DELETE /api/entities/:id`; `GET/POST /api/clients`, `PUT/DELETE /api/clients/:id`
- **Env var**: `ENTITIES_TABLE`, `CLIENTS_TABLE`, `CLIENT_USERS_TABLE`, `DATA_SOURCES_TABLE` — DynamoDB table names

## Widgets admin pages

- **List page**: `/widgets` (internal admin only). Lists all widget types from the static registry with DynamoDB name overrides. Widget names are clickable links to detail pages. Admins can rename widget types (stored in `WidgetTypeMeta` table) or reset to original names.
- **Detail page**: `/widgets/[id]` — shows widget type info (name, category, component, KPI config for KPI widgets), rename action, and a usage table listing all dashboards across all clients that use this widget type. Client names link to `/clients/[id]`.

## Multi-entity support

- **Entity selector**: Multi-select checkbox dropdown in header (select one, multiple, or all entities)
- **Multi-select merge**: When multiple entities selected, fetches each in parallel, merges financial rows by category (sums all period values via `mergeFinancialRows`). Output is structurally identical to single-entity data so all compute functions work unchanged.
- **React context**: `EntityProvider` / `useEntity()` in `src/context/EntityContext.tsx` provides `entities`, `entitiesLoading`, `selectedEntities`, `setSelectedEntities`, `refreshEntities`
- **Auto-refetch**: Dashboard pages auto-fetch on mount when entities are ready

## DynamoDB caching (`src/lib/cache.ts`)

- **Table**: PLCache (defined in `amplify/backend.ts`, provisioned via Amplify sandbox/pipeline)
- **Key**: `entityId` (partition key) — stores composite key `{clientId}#{entityId}`
- **Staleness**: 24-hour TTL — serves cached data if fresher than 24h, otherwise re-fetches from CData
- **Pattern**: Cache-first read, fire-and-forget write (via `src/lib/fetch-pl.ts`)
- **Combined mode**: Each entity cached individually; combined view does parallel cache lookups then in-memory merge
- **Env var**: `PL_CACHE_TABLE` — DynamoDB table name

## Data sources

- **Admin page**: `/data-sources` — internal admin only. Table listing all data sources with name, type, status. CRUD via modals.
- **Type registry**: `src/lib/data-source-types.ts` — defines known types (e.g. `cdata` = CData Connect Cloud, `turbotax` = TurboTax) with connection-level `fields` (key, label, sensitive flag, placeholder) and entity-level `entityFields`. Type is selected via dropdown when creating a data source. Connection fields are rendered in the data source admin modal; entity fields are rendered dynamically in the entity add/edit modal based on the selected data source's type.
- **DynamoDB**: `DataSources` table (id, type, displayName, config, status, createdAt). No GSI — global scan (few records).
- **CRUD**: `src/lib/data-sources.ts` — `getDataSources()`, `getDataSource(id)`, `addDataSource()`, `updateDataSource()`, `deleteDataSource()`
- **Entity binding**: Entities support multiple data source bindings via `dataSourceBindings` array. Entity modals render stacked binding sections (each with a DS dropdown + entity-level fields) with Add/Remove buttons. When no data sources exist, a hint is shown and entities can be saved without bindings. Switching a binding's data source clears that binding's entity-level field values.
- **Fetch integration**: `src/lib/fetch-pl.ts` resolves adapter type + credentials from the entity's primary (first) data source binding via legacy `dataSourceId`/`sourceConfig` fields. Falls back to global `CDATA_USER`/`CDATA_PAT` env vars if no binding.
- **Delete protection**: API returns 409 Conflict if any entity references a data source being deleted (checks all bindings via `getEntityBindings()`).

## Data abstraction layer

- **Financial model**: `FinancialRow { category, periods: Record<"2024-01", number> }` in `src/lib/models/financial.ts` — source-agnostic representation
- **Adapter pattern**: `DataAdapter` interface in `src/lib/adapters/base.ts` — each data source implements `fetchFinancialData(sourceConfig, credentials) → FinancialRow[]` (both params are generic `Record<string, string>`)
- **QuickBooksAdapter**: `src/lib/adapters/quickbooks.ts` — wraps CData, normalizes `Jan_2024` columns to `2024-01` period keys
- **Adapter registry**: `getAdapter(type)` in `src/lib/adapters/index.ts` — type resolved from entity's data source record (e.g. `cdata` → `quickbooks`)
- **Downstream code** (cache, compute, merge) works exclusively with `FinancialRow` — no source-specific types

## CData integration (`src/lib/cdata.ts`)

- **Endpoint**: `POST https://cloud.cdata.com/api/query` with Basic Auth (username + PAT)
- **SQL query**: `SELECT * FROM {catalog}.QuickBooksOnline.PL WHERE RowType = 'Summary' AND RowId IS NULL`
- **Table format**: `{catalog}.{schema}.{table}` (e.g. `BrooklynRestaurants.QuickBooksOnline.PL`)
- **CDataPLRow**: Raw row type with `account`, `RowGroup`, `RowType`, `RowId`, monthly columns (`Jan_2024` through `Dec_2026`), `Total` — adapter-internal, not used downstream
- **RowGroups**: Income, COGS, GrossProfit, Expenses, NetOperatingIncome, OtherIncome, OtherExpenses, NetOtherIncome, NetIncome
- `buildGroupValues(rows, year)` — extracts monthly values from `FinancialRow.periods` for a given year into `Map<string, number[]>` (indices 0-11 = Jan-Dec, 12 = computed total)

## Tools — Sandbox Data Sync

Admin tool at `/tools` for copying the Entities DynamoDB table between environments:
- **Sandboxes**: Defined in `src/lib/sandboxes.ts` — Win Desktop, Win XPS, Production (each with a table prefix)
- **Discovery**: `discoverEntitiesTable(prefix)` in `src/lib/sync-sandbox.ts` uses `ListTablesCommand` to find Entities tables by prefix
- **Preview**: Shows source/destination item counts and source items before sync
- **Execute**: Clears destination table, batch-writes all source items
- **API**: `POST /api/tools/sync-sandbox` with `{ action, sourceId, destinationId }`
- **IAM**: SSR compute role needs `dynamodb:ListTables` on `*` and read/write on `arn:aws:dynamodb:*:*:table/amplify-*`

## API

### Data source management (internal admin only)
- **Data sources**: `GET /api/data-sources` — list all data sources; `POST /api/data-sources` — add `{ type, displayName, config }`; `GET /api/data-sources/:id` — get single; `PUT /api/data-sources/:id` — update `{ displayName, config, status }`; `DELETE /api/data-sources/:id` — delete (409 if entities bound)

### Entity & client management
- **Entities**: `GET /api/entities` — list entities for current client; `POST /api/entities` — add entity `{ displayName, dataSourceBindings? }`; `PUT /api/entities/:id` — edit entity (accepts `dataSourceBindings`); `DELETE /api/entities/:id` — remove entity
- **Clients**: `GET /api/clients` — list all clients (internal admin only); `POST /api/clients` — add client `{ slug, displayName, firstName?, lastName?, email? }`; `PUT /api/clients/:id` — edit client; `DELETE /api/clients/:id` — remove client
- **Auth context**: `GET /api/auth/context` — returns current user's auth context (clientId, role, isInternal, clients list, authorizedPackageIds)
- **Client users**: `GET /api/client-users?clientId=` — list client users (internal admin only); `POST /api/client-users` — create client user + Cognito account + invite email `{ clientId, email, firstName, lastName, authorizedPackageIds }`; `GET /api/client-users/:id` — get single; `PUT /api/client-users/:id` — update (Cognito disable/enable on status change) `{ firstName, lastName, status, authorizedPackageIds }`; `DELETE /api/client-users/:id` — cascade delete (Cognito user + membership + record)

### Package / dashboard / widget management (internal admin only for writes)
- **Packages**: `GET /api/packages?clientId=` — list packages; `POST /api/packages` — add package `{ clientId, slug, displayName, sortOrder }`; `PUT /api/packages/:id` — edit; `DELETE /api/packages/:id` — cascade delete (dashboards + widgets)
- **Dashboards**: `GET /api/dashboards?packageId=|clientId=` — list dashboards; `POST /api/dashboards` — add `{ packageId, clientId, slug, displayName, sortOrder }`; `PUT /api/dashboards/:id` — edit; `DELETE /api/dashboards/:id` — cascade delete (widgets)
- **Dashboard resolve**: `GET /api/dashboards/resolve?packageSlug=&dashboardSlug=&clientId=` — resolve dashboard from URL slugs (enforces package authorization for client users)
- **Dashboard widgets**: `GET /api/dashboards/:id/widgets` — list widgets; `POST /api/dashboards/:id/widgets` — add `{ widgetTypeId, sortOrder, config? }`; `PUT /api/dashboards/:id/widgets/:widgetId` — edit; `DELETE /api/dashboards/:id/widgets/:widgetId` — remove
- **Widget types**: `GET /api/widget-types` — list all types with name overrides; `GET /api/widget-types/:id` — get single type detail; `PUT /api/widget-types/:id` — rename (empty displayName resets to default); `GET /api/widget-types/:id/usage` — list dashboards using this type (with client/package context)

### Widget data (financial data endpoints)
- **Financial snapshot**: `GET /api/widget-data/financial-snapshot?month=YYYY-MM&entities=id1,id2&refresh=true` — returns `{ kpis, pnlByMonth, selectedMonth, entityName }`
- **Expense trend**: `GET /api/widget-data/expense-trend?startMonth=YYYY-MM&endMonth=YYYY-MM&entities=id1,id2&refresh=true` — returns `{ data: TrendDataPoint[], entityName }`

### Other
- **Sandbox sync**: `POST /api/tools/sync-sandbox` — `{ action: "preview"|"execute", sourceId, destinationId }`
- All endpoints: cookie-based Cognito auth via Amplify SSR
- `?entities` accepts comma-separated entity IDs (validated against Entities table)
- `?refresh=true` bypasses DynamoDB cache and fetches fresh from CData
- Slug validation: `^[a-z0-9-]+$` (lowercase letters, numbers, hyphens)

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

CData credentials (`CDATA_USER`, `CDATA_PAT`, `CDATA_CATALOG`), all DynamoDB table names (`PL_CACHE_TABLE`, `ENTITIES_TABLE`, `CLIENTS_TABLE`, `CLIENT_MEMBERSHIPS_TABLE`, `PACKAGES_TABLE`, `DASHBOARDS_TABLE`, `DASHBOARD_WIDGETS_TABLE`, `WIDGET_TYPE_META_TABLE`, `CLIENT_USERS_TABLE`, `DATA_SOURCES_TABLE`), and `COGNITO_USER_POOL_ID` are inlined into the Next.js bundle via `next.config.ts` `env` property. Table names and User Pool ID fall back to `amplify_outputs.json` custom/auth outputs if env vars are not set. On Amplify hosting these are set as environment variables in the Amplify console. For local dev, use `.env.local`.

## Local development

```bash
# Terminal 1: Deploy sandbox backend
npx ampx sandbox

# Terminal 2: Start frontend
npm run dev
```

Create `.env.local` with `CDATA_USER`, `CDATA_PAT`, `CDATA_CATALOG`, `PL_CACHE_TABLE`, `ENTITIES_TABLE`, `CLIENTS_TABLE`, `CLIENT_MEMBERSHIPS_TABLE`, `PACKAGES_TABLE`, `DASHBOARDS_TABLE`, `DASHBOARD_WIDGETS_TABLE`, `WIDGET_TYPE_META_TABLE`, `CLIENT_USERS_TABLE`, `DATA_SOURCES_TABLE`.

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
