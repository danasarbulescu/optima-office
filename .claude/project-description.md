# Project Description

We are a fractional accounting firm with 500 clients and we want to offer customized financial reporting to our clients. The application lets us manage clients, their data sources, and build custom dashboards with configurable widgets.

Financial data from external sources (QuickBooks via CData Connect Cloud, TurboTax, etc.) is normalized into an internal data warehouse, which serves as the single source of truth for all reporting. Each client can have multiple sub-accounts (client users) with granular access control over which reports they can see.

Reports are built from widgets — reusable UI components defined in code. Widgets are placed on Dashboards, which are grouped into Packages. A client can have multiple packages, each containing multiple dashboards, each containing multiple widgets. This hierarchy (Package → Dashboard → Widget) provides flexible organization of financial reports.

The application has an admin area (for internal staff) and a client area (for client users). Admins can impersonate specific client users to see exactly what they see (restricted packages/dashboards, default landing page), for debugging and support.

## Admin Area

### Data Sources

`/data-sources` — Internal admin only.

Table listing all configured data source integrations (name, type, status). Each data source defines an external system we pull financial data from.

A data source has:
- **Display name**
- **Type** — selected from a registry of supported integrations (e.g., CData Connect Cloud, TurboTax). Each type defines its own connection-level fields (username, API token, etc.) and entity-level fields (catalog ID, source ID, etc.).
- **Connection fields** — global credentials for the integration (e.g., username, personal access token). Sensitive fields are masked.
- **Status** — active or archived.

Data sources can be added, edited, and deleted. Deletion is blocked if any entity references the data source (returns a conflict error).

### Widget Types

`/widgets` — Internal admin only.

Table listing all widget types from the static code registry, with category, component type, and display name. Widget types are defined in code — the only setting editable via UI is the display name (stored as a DynamoDB override; original name shown if customized).

Clicking a widget type opens its detail page.

`/widgets/:id` — Widget type detail page showing:
- **Info section**: display name (inline editable), category, component, KPI configuration details. Name can be reset to the code-defined default.
- **Live preview**: renders the actual widget component using real warehouse data from a configurable entity. Includes a month picker that defaults to the latest month with data.
- **Usage table**: lists all dashboards across all clients that use this widget type, with links to the client detail page.

### Clients

`/clients` — Internal admin only.

Sortable table of all clients (display name, slug). Clients can be added, archived, or deleted. Archived clients are hidden from the main list and accessible via an "Archived" toggle. Deletion cascades to all client dependencies: client users (including Cognito accounts), entities (including warehouse data), packages, dashboards, and widgets.

Clicking a client opens the client detail page.

`/clients/:id` — Full management hub for a single client, with sections for:

#### Client Info

Display name, slug, contact fields (first name, last name, email), and status (active/archived). Editable via modal.

#### Client Users

Sub-accounts within a client, each with their own Cognito login and restricted access to specific packages and dashboards.

A client user has:
- **First name, last name, email** (email is the Cognito login — editable, which recreates the Cognito account)
- **Status** — active or archived (synced with Cognito enable/disable)
- **Authorized packages** — grants access to all dashboards within selected packages
- **Authorized dashboards** — grants access to individual dashboards (independent of package-level access)
- **Default dashboard** — optional landing page on login

Client users are created with an optional email invite (sends Cognito temporary password). Access is managed via a dedicated "Manage Access" modal with a package → dashboard tree and a default dashboard picker. Deletion cascades to the Cognito user, client membership, and client user record.

A dashboard is accessible to a client user if its parent package is in their authorized packages OR its ID is in their authorized dashboards. Archived client users are denied access entirely.

#### Entities

The businesses owned by the client and managed by our firm. Each entity represents a QuickBooks company (or other financial data source) and is used to segment the client's data by business.

An entity has:
- **Display name**
- **Data source bindings** — one or more data sources (selected from the global data sources list), each with its own entity-level credentials (e.g., catalog ID). These override the data source's global connection settings.

Each entity has a **Sync** button that pulls fresh financial data from the external source into the warehouse. Deletion cascades to all warehouse data for that entity.

#### Packages, Dashboards & Widgets

Managed via a nested accordion UI on the client detail page.

- **Packages** group dashboards (e.g., "Financial Reports"). Have a display name, URL slug, and sort order. Deletion cascades to all contained dashboards and their widgets.
- **Dashboards** are pages within a package (e.g., "Monthly Dashboard"). Have a display name, URL slug, and sort order. Deletion cascades to all contained widgets.
- **Widgets** are instances of widget types placed on a dashboard. Each references a widget type by ID and has a sort order. When a widget is placed on a client's dashboard, it uses that client's entity data from the warehouse.

Slugs are auto-generated from display names and used in URLs (`/{packageSlug}/{dashboardSlug}`).

### Tools

`/tools` — Internal admin only.

**Sandbox Data Sync**: copies the Entities DynamoDB table between developer environments (Win Desktop sandbox, Win XPS sandbox, Production). Shows a preview of source/destination item counts before executing.

## Client Area

### Dashboard Experience

`/{packageSlug}/{dashboardSlug}` — The main client-facing view.

Each dashboard page:
1. Displays the package name and dashboard title
2. Renders configured widgets based on their type and sort order
3. Auto-loads data from the warehouse when navigating to the page
4. Shows appropriate controls based on which widget types are present

**Financial snapshot controls** (shown if dashboard has KPI cards or P&L table):
- Month picker to select the reporting period
- Load button (reads from warehouse/cache)
- Sync button (bypasses cache, fetches fresh from the external data source)

**Expense trend controls** (shown if dashboard has a trend chart):
- From/To month range pickers
- Sync button

**Widget types currently available:**
- **KPI Cards** (9 types): Revenue, Gross Margin, and Net Income metrics — current month, 3-month average, YTD, and prior year, with year-over-year variance where applicable
- **P&L Table**: 13-month trailing profit & loss statement with Revenue, COGS, Gross Profit, Expenses, Net Operating Income, and percentages
- **Expense Trend Chart**: line chart showing monthly operating expenses with a 13-month rolling average

When no warehouse data exists for the selected entities, the dashboard shows a message prompting the user to perform a sync first.

### Multi-Entity Support

Users can select one, multiple, or all entities via a multi-select dropdown in the header. When multiple entities are selected, data is fetched for each in parallel and merged by category (values summed across entities). The merged output is structurally identical to single-entity data, so all widgets render without special handling.

### Navigation

Packages and dashboards appear as navigation items:
- Packages with a single dashboard render as a direct link
- Packages with multiple dashboards render as a dropdown menu
- Internal admins also see admin links (Clients, Data Sources, Widgets, Tools) — hidden during impersonation

### Client User Impersonation

Internal admins can click the eye icon on any client user row (in the client detail page) to impersonate that user:
- Header turns poppy red to indicate impersonation mode
- Header shows "admin@email.com as FirstName LastName"
- Admin navigation links are hidden
- Only the client user's authorized packages/dashboards are visible
- Sign Out button is replaced with "Admin View" button
- Navigates to the user's default dashboard (or first authorized dashboard)
- Clicking "Admin View" confirms and returns to the Clients admin page
- Auto-clears when switching to a different client

### Default Dashboard

Client users can have a configured default dashboard. On login, they are redirected directly to that dashboard instead of the first available one.

## Data Warehouse

Financial data from external sources is normalized into a DynamoDB-based warehouse (the FinancialData table). Data is stored at the granularity of one item per entity + category + period (e.g., entity "Brooklyn Restaurants", category "Income", period "2024-01" → $50,000).

The data fetch pipeline has three tiers:
1. **P&L Cache** (hot blob cache, 24-hour TTL) — fast reads for dashboard rendering
2. **Warehouse** (persistent per-period storage) — the source of truth, no expiration
3. **External API** (CData, etc.) — fetched on sync or cache miss

On cache miss, warehouse data repopulates the cache. On warehouse miss (or manual sync), data is fetched from the external source and written to both warehouse and cache.

## Data Adapters

Each data source type has a corresponding adapter that normalizes the source's data format into a common `FinancialRow` model (`{ category, periods: Record<string, number> }`). Downstream code (cache, compute, merge, widgets) works exclusively with this normalized format — no source-specific types leak through.

Currently implemented:
- **QuickBooks adapter** (via CData Connect Cloud): normalizes CData's column format (`Jan_2024`, `Feb_2024`, etc.) into period keys (`2024-01`, `2024-02`, etc.)

## Authentication & Authorization

- **Cognito** handles user authentication (email-based, no self-signup)
- **Internal admins**: see all clients, can switch between them via a dropdown, see all packages/dashboards plus admin pages
- **Client admins**: locked to their assigned client, see all of that client's packages and dashboards
- **Client viewers**: locked to their client, restricted to authorized packages and dashboards only
- **Client users**: sub-accounts with fine-grained access — authorized at both package level (all dashboards in the package) and individual dashboard level
