Architecture: Multi-Tenant SaaS for 500 Clients
The Big Picture
One deployed platform. Internal team sees all clients via a tenant picker. Each client logs in and sees only their own data. Developers build per-client customizations as code modules.

1. Multi-Tenancy Model
Tenant = Client Company. The current Clients table evolves into a Tenants table:

Field	Description
id (PK)	UUID
slug	URL-safe name (e.g. brooklyn-restaurants) — used in routes
displayName	Human-readable
dataSource	`{ provider: "quickbooks"
enabledModules	["dashboard", "trend", "custom-acme-cashflow"]
moduleConfig	Per-module settings (which KPIs, thresholds, etc.)
theme	Optional branding (logo, colors)
contacts	Contact info
Every API request is scoped to a tenant. Internal users can switch tenants; client users are locked to theirs.

2. Auth & Authorization
Stay on Cognito, single user pool. Add custom attributes:

custom:tenantId — UUID, or "*" for internal team
custom:role — internal-admin, tenant-admin, tenant-viewer
Next.js middleware extracts these from the JWT on every request:

Internal users → can switch tenants via a picker
Client users → locked to their tenantId, no switching
No separate user pools needed. Cognito handles this fine at 500 tenants.

3. Data Abstraction Layer
Problem: Current code hardcodes QuickBooks schema (RowGroups, monthly columns like Jan_2024). Different accounting platforms have different schemas.

Solution: Adapter pattern.

Define a common financial model:


FinancialRow { category, subcategory?, periods: Map<"2025-01", number>, total }
Then one adapter per platform:

QuickBooksAdapter — refactor of current cdata.ts
XeroAdapter — maps Xero's chart of accounts
FreshBooksAdapter — maps FreshBooks
All adapters use CData Connect Cloud as transport — only the SQL queries and column mappings differ. The cache stores normalized data, so everything downstream (compute, rendering) works identically regardless of source.

4. Module/Plugin System
This is the core of the "bespoke" capability. Each feature is a module — a self-contained directory with a page, API route, and business logic:


src/modules/
  dashboard/           — Standard P&L dashboard (KPI cards + table)
    index.ts           — Manifest: { id, name, route, defaultConfig }
    page.tsx
    api/route.ts
    compute.ts
  trend-analysis/      — Standard trend chart
    ...
  alerts/              — Standard KPI threshold alerting
    ...
  custom/
    acme-cashflow/     — Bespoke module for one client
    bigco-weekly/      — Bespoke module for another
Per-tenant config controls what each client sees:


{
  "enabledModules": ["dashboard", "trend-analysis", "acme-cashflow"],
  "moduleConfig": {
    "dashboard": {
      "kpis": ["revenue", "grossMargin", "netIncome"],
      "showPnlTable": true
    }
  }
}
Routing: Dynamic route /(authed)/[tenantSlug]/[...modulePath] resolves tenant → checks enabled modules → renders. Standard clients get standard modules. Bespoke clients get custom ones. A developer builds a new module by adding files to src/modules/custom/, enabling it for the tenant, and deploying.

5. Infrastructure
Move from Amplify Gen 2 → Standalone CDK
Amplify Gen 2 works for simple apps but constrains you at this scale. You'll need EventBridge, SQS, custom IAM, multiple tables — CDK gives full control.

Layer	Tech	Why
Frontend + API	Next.js 15 (keep)	Works well, no reason to change
Hosting	Amplify Hosting (keep) or ECS Fargate	Amplify Hosting is fine for SSR
Infrastructure	Standalone CDK	Full control over all AWS resources
Auth	Cognito (keep)	Add custom attributes for multi-tenancy
Database	DynamoDB (keep)	Scales easily, pay-per-request
Background jobs	EventBridge Scheduler + Lambda	Nightly data refresh, scheduled reports, alerts
Email	Amazon SES	Report delivery, alerts
File storage	S3	PDF exports, per-tenant logos
Queues	SQS	Fan-out: one job per tenant for bulk operations
DynamoDB Tables
Tenants — PK: id, GSI on slug
DataCache — PK: tenantId, SK: {dataType}#{period} (replaces PLCache)
ModuleState — PK: tenantId, SK: {moduleId}#{stateKey} (alert thresholds, last-run times, etc.)
Users — or just use Cognito as source of truth
Background Processing

EventBridge (nightly)
  → SQS (one message per tenant)
    → Lambda: refresh cached data
    → Lambda: check alert thresholds → SES email
    → Lambda: generate weekly PDF → S3 → SES
6. Developer Workflow
Onboard a standard client (~5 min, no code)

npx tsx scripts/add-tenant.ts --name "ACME" --slug "acme" --provider quickbooks --catalogId "AcmeCorp" --modules dashboard,trend
npx tsx scripts/add-user.ts --email "cfo@acme.com" --tenantId "<uuid>" --role tenant-admin
# Done. Client logs in at /acme/dashboard
Build a bespoke feature

npx tsx scripts/new-module.ts --id "acme-cashflow" --tenant "acme"
# Creates src/modules/custom/acme-cashflow/ with scaffold
# Developer implements the feature
# Enable: npx tsx scripts/enable-module.ts --tenant "acme" --module "acme-cashflow"
git push  # Single deployment serves all tenants
Monorepo (Turborepo)

packages/
  core/       — Shared types, auth, tenant resolution, data adapters
  ui/         — Reusable React components (KPI cards, charts, tables)
  db/         — DynamoDB client, schemas, CRUD
apps/
  web/        — Next.js app with modules
  infra/      — CDK stacks
  scripts/    — CLI tooling