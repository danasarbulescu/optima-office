# QuickBooks Export

TypeScript CLI tool that fetches P&L data from CData Connect Cloud and generates an HTML financial dashboard.

## Workflow

`npm start -- --month YYYY-MM` — fetches P&L summary data from CData, computes KPIs, and writes `output/dashboard.html`.

## Project structure

```
src/
  generate-report.ts  — CLI entry point: fetches data, computes KPIs, generates HTML dashboard
  cdata.ts            — CData Connect Cloud API client (SQL query, PL summary fetch, GroupValues builder)
output/
  dashboard.html      — Generated financial dashboard (not committed)
```

## Environment

- **Runtime**: Node.js with ts-node (no build step needed for dev)
- **Language**: TypeScript (strict mode, ES2020 target, commonjs modules)
- **Key dependencies**: axios, dotenv
- **Config**: `.env` file with `CDATA_USER`, `CDATA_PAT`, `CDATA_CATALOG`

## CData integration (`cdata.ts`)

- **Endpoint**: `POST https://cloud.cdata.com/api/query` with Basic Auth (username + PAT)
- **SQL query**: `SELECT * FROM {catalog}.QuickBooksOnline.PL WHERE RowType = 'Summary' AND RowId IS NULL`
- **Table format**: `{catalog}.{schema}.{table}` (e.g. `BrooklynRestaurants.QuickBooksOnline.PL`)
- **PL table columns**: `account`, `RowGroup`, `RowType`, `RowId`, monthly columns (`Jan_2024` through `Dec_2026`), `Total`
- **RowGroups**: Income, COGS, GrossProfit, Expenses, NetOperatingIncome, OtherIncome, OtherExpenses, NetOtherIncome, NetIncome
- `buildGroupValues(rows, year)` — extracts monthly values for a given year into `Map<string, number[]>` (indices 0-11 = Jan-Dec, 12 = computed total)

## Dashboard (`generate-report.ts`)

The dashboard is a self-contained HTML file (no external dependencies) with:
- **9 KPI cards** in 2 rows: Revenue, Gross Margin, Net Income, YTD/YOY comparisons
- **13-month P&L table**: trailing window relative to `--month` (e.g. `--month 2025-10` shows Oct 24 through Oct 25)

Key internal functions:
- `computeKPIs(curGroups, pyGroups, monthIdx)` — derives all dashboard metrics from current and prior year GroupValues
- `build13MonthPnL(curGroups, pyGroups, selectedMonth)` — builds 13-month trailing P&L data
- `generateHTML(kpis, selectedMonth, pnlByMonth)` — renders the full dashboard HTML with inline CSS

## npm scripts

- `npm start -- --month YYYY-MM` — generate dashboard (aliases: `npm run report`)
- `npm run build` — compiles TypeScript to `dist/`
