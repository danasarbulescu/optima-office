# QuickBooks Export

Web dashboard that fetches P&L data from CData Connect Cloud and renders a financial dashboard. Deployed on AWS Amplify with Cognito authentication.

## Workflows

- **Web app**: `npm run dev` — local Next.js dev server (requires `npx ampx sandbox` running for backend)
- **Build**: `npm run build` — Next.js production build to `.next/`

## Project structure

```
amplify/
  auth/resource.ts                  — Cognito auth (email, no self-signup)
  backend.ts                        — defineBackend (auth-only)
src/
  app/
    layout.tsx                      — Root layout with ConfigureAmplify
    page.tsx                        — Home redirector (auth check)
    globals.css                     — Global styles
    login/page.tsx                  — Login page with Authenticator
    (authed)/
      layout.tsx                    — Protected layout (header, sign out)
      dashboard/
        page.tsx                    — Dashboard: month picker, refresh, render
        dashboard.css               — Dashboard-specific styles
    api/
      dashboard/route.ts            — API route: CData fetch + compute + JSON
  components/
    ConfigureAmplify.tsx            — Client component for Amplify SSR config
  utils/
    amplify-utils.ts                — Server-side Amplify runner
  lib/
    types.ts                        — Shared interfaces (KPIs, PnLByMonth, CDataPLRow, etc.)
    cdata.ts                        — CData API client (parameterized credentials)
    compute.ts                      — buildGroupValues, computeKPIs, build13MonthPnL
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
- **Backend**: AWS Amplify Gen 2 (Cognito auth only)
- **Key dependencies**: axios, aws-amplify, @aws-amplify/adapter-nextjs, @aws-amplify/ui-react, next, react
- **Web app config**: CData credentials set as Amplify hosting environment variables (or `.env.local` for local dev)

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

## API

- **Endpoint**: `GET /api/dashboard?month=YYYY-MM` (cookie-based Cognito auth via Amplify SSR)
- **Response**: `{ kpis: KPIs, pnlByMonth: PnLByMonth, selectedMonth: string, clientName: string }`
- Frontend calls `generateHTML()` client-side with the JSON response

## npm scripts

- `npm run dev` — Next.js dev server
- `npm run build` — Next.js production build (uses `.next/`, will disrupt running dev server)
- `npm run build:check` — production build to `.next-build/` (safe to run alongside dev server)
- `npm run start` — Next.js production server

## CI/CD (`amplify.yml`)

- **Backend**: `npm ci` then `npx ampx pipeline-deploy` (deploys Cognito resources per branch)
- **Frontend**: `npm ci` then `npm run build`, artifacts from `.next/`
- **Caches**: `.next/cache`, `node_modules`, `.npm`

## Build-time env inlining (`next.config.ts`)

CData credentials (`CDATA_USER`, `CDATA_PAT`, `CDATA_CATALOG`) are inlined into the Next.js bundle via `next.config.ts` `env` property. On Amplify hosting these are set as environment variables in the Amplify console. For local dev, use `.env.local`.

## Local development

```bash
# Terminal 1: Deploy sandbox backend
npx ampx sandbox

# Terminal 2: Start frontend
npm run dev
```

Create `.env.local` with `CDATA_USER`, `CDATA_PAT`, `CDATA_CATALOG`.

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

**Production**
- User Pool Id: `us-east-2_IqqSQubzw`
- User id: `b1eb05d0-2021-70ed-627a-9a99b4f566e3`
- User admin email: `dana.sarbulescu@gmail.com`

<!-- Last deployment test: 2026-02-03 -->
