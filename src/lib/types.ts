import { FinancialRow } from './models/financial';

export interface DataSourceBinding {
  dataSourceId: string;
  sourceConfig: Record<string, string>;
}

export interface EntityConfig {
  id: string;          // Internal UUID (DynamoDB partition key)
  clientId: string;    // Client this entity belongs to
  catalogId: string;   // CData catalog name (legacy, kept for backward compat)
  displayName: string; // Human-readable label for the UI
  dataSourceId?: string; // Legacy single binding (synced from dataSourceBindings[0])
  sourceConfig?: Record<string, string>; // Legacy single binding
  dataSourceBindings?: DataSourceBinding[]; // Multiple data source bindings
  createdAt?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

/** Normalizes entity bindings: returns dataSourceBindings if present, else reconstructs from legacy fields */
export function getEntityBindings(entity: EntityConfig): DataSourceBinding[] {
  if (entity.dataSourceBindings && entity.dataSourceBindings.length > 0) {
    return entity.dataSourceBindings;
  }
  if (entity.dataSourceId) {
    return [{
      dataSourceId: entity.dataSourceId,
      sourceConfig: entity.sourceConfig || { catalogId: entity.catalogId },
    }];
  }
  return [];
}

export interface DataSource {
  id: string;
  type: string;                    // 'cdata' for now
  displayName: string;
  config: Record<string, string>;  // Type-specific: {user, pat} for CData
  status: 'active' | 'archived';
  createdAt: string;
}

export interface Client {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  createdAt: string;
  status?: string;
}

export type ClientRole = 'internal-admin' | 'client-admin' | 'client-viewer';

export interface ClientMembership {
  userId: string;       // Cognito sub
  clientId: string;     // "*" = internal (all clients)
  role: ClientRole;
  clientUserId?: string; // Links to ClientUsers table for restricted access
}

export interface AuthContext {
  userId: string;
  clientId: string;     // Resolved client (for internal, the currently-selected one)
  role: ClientRole;
  isInternal: boolean;  // true if clientId === "*"
  authorizedPackageIds?: string[] | null; // null/undefined = full access; string[] = restricted
  authorizedDashboardIds?: string[] | null; // null/undefined = full access; string[] = restricted
  authorizedEntityIds?: string[] | null; // null/undefined = full access; string[] = restricted
  defaultDashboardId?: string;
}

export interface ClientUser {
  id: string;
  clientId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'archived';
  authorizedPackageIds: string[];
  authorizedDashboardIds?: string[];
  authorizedEntityIds?: string[];
  defaultDashboardId?: string;
  cognitoUserId?: string;
  createdAt: string;
}

export interface PnLMonthEntry {
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netOperatingIncome: number;
  otherExpenses: number;
  netOtherIncome: number;
  netIncome: number;
}

export interface PnLByMonth {
  months: PnLMonthEntry[];
  totals: Omit<PnLMonthEntry, 'label'>;
}

export interface TrendDataPoint {
  month: string;
  expenses: number;
  avg13: number | null;
}

export interface PLCacheEntry {
  entityId: string;
  entityName: string;
  rows: FinancialRow[];
  fetchedAt: string;
  ttl: number;
}

export interface FinancialDataItem {
  entityId: string;       // Entity UUID (PK)
  sk: string;             // "{category}#{period}" or "#metadata" or "class#..." (SK)
  category?: string;
  period?: string;
  value?: number;
  sourceType?: string;    // "quickbooks", etc.
  syncedAt?: string;      // ISO timestamp
  entityName?: string;    // metadata only
  lastSyncedAt?: string;  // metadata only
  classId?: string;       // class data items only
  className?: string;     // class metadata only
  classes?: DiscoveredClass[]; // #classes index item only
}

export interface DiscoveredClass {
  id: string;        // QuickBooks class ID (from PL_ table name suffix)
  name: string;      // Human-readable name (from Class table)
  tableName: string;  // CData table name (e.g., PL_2100000000001402200)
}

export interface Package {
  id: string;
  clientId: string;
  slug: string;
  displayName: string;
  sortOrder: number;
  createdAt: string;
}

export interface Dashboard {
  id: string;
  packageId: string;
  clientId: string;
  slug: string;
  displayName: string;
  sortOrder: number;
  createdAt: string;
}

export interface DashboardWidget {
  id: string;
  dashboardId: string;
  widgetTypeId: string;
  sortOrder: number;
  config?: Record<string, unknown>;
  createdAt: string;
}

export interface WidgetTypeMeta {
  id: string;           // Same as widget type ID from registry
  displayName: string;  // Admin-overridden display name
  description?: string; // Admin-entered description
}

// ── Budget data types ─────────────────────────────────────────────────────────

/** Monthly budget/actual values keyed by period string ("2026-01") */
export type BudgetMonthMap = Record<string, number>;

/** One P&L line from the budget spreadsheet */
export interface BudgetLine {
  accountCode: string | null;   // "4004-00", null for subtotals
  accountName: string;          // "Wash Sales"
  rowType: 'account' | 'subtotal' | 'section';
  depth: number;                // Indentation depth (0 = top-level)
  monthly: BudgetMonthMap;      // { "2026-01": 121540, ... }
  annualTotal: number | null;
  actuals2025: number | null;   // Prior-year full-year actuals from the spreadsheet
}

/** One operational metric series (car count, gallons, membership, etc.) */
export interface BudgetMetric {
  key: string;           // "carCount", "totalGallons", "membershipCount", etc.
  label: string;         // Original spreadsheet row label
  monthly: BudgetMonthMap | null;
  constant: number | null;   // Non-null when same value every month (e.g. cost/gallon)
  annualTotal: number | null;
}

/** Budget data for one class (location) stored as a DynamoDB blob item */
export interface BudgetClassData {
  entityId: string;
  sk: string;                  // "budget#2026#class#{classId}"
  fiscalYear: number;
  classId: string;             // QuickBooks class ID (matches DiscoveredClass.id)
  className: string;           // Human-readable class name (e.g. "01 - Huntington Beach")
  locationCode: string;        // "01", "03", etc.
  tabName: string;             // Original Excel tab name
  budgetLines: BudgetLine[];
  metrics: BudgetMetric[];
  importedAt: string;          // ISO timestamp of last import
}

/** Summary metadata item listing all classes with budget data for an entity+year */
export interface BudgetMetadataItem {
  entityId: string;
  sk: string;                  // "budget#2026#metadata"
  fiscalYear: number;
  classes: Array<{
    classId: string;
    className: string;
    locationCode: string;
    importedAt: string;
  }>;
  importedAt: string;
}

// ── Budget vs. Actual response types ─────────────────────────────────────────

/** One row in the budget vs. actual table (account, subtotal, or section) */
export interface BudgetVsActualRow {
  accountCode: string | null;
  accountName: string;
  rowType: 'account' | 'subtotal' | 'section';
  depth: number;
  /** Per-class actual + budget amounts keyed by classId */
  byClass: Record<string, { actual: number; budget: number }>;
  total: { actual: number; budget: number };
}

/** Full response from GET /api/widget-data/budget-vs-actual */
export interface BudgetVsActualData {
  month: string;       // "2026-01"
  year: number;
  daysInMonth: number; // for client-side forecast calculation
  entityId: string;
  classes: Array<{ classId: string; className: string; locationCode: string }>;
  rows: BudgetVsActualRow[];
}

// ── Summary Budget vs. Actual response types ────────────────────────────────

/** One metric row in the summary budget-vs-actual table (e.g. Car Count) */
export interface SummaryBvaRow {
  label: string;           // "Car Count"
  metricKey: string;       // "carCount"
  format?: 'number' | 'currency';  // default 'number'
  byClass: Record<string, { actual: number; budget: number }>;
  total: { actual: number; budget: number };
}

/** Full response from GET /api/widget-data/summary-bva */
export interface SummaryBvaData {
  month: string;       // "2026-01"
  year: number;
  daysInMonth: number;
  entityId: string;
  classes: Array<{ classId: string; className: string; locationCode: string }>;
  rows: SummaryBvaRow[];
}

// ── Comparative Snapshot P&L ─────────────────────────────────────────────────

export interface ComparativeSnapshotRow {
  label: string;
  currentQ: number;
  priorYearQ: number;
  chgQoQ: number | null;
  currentMonth: number;
  priorYearMonth: number;
  chgMoM: number | null;
  ytdCurrent: number;
  ytdPrior: number;
  chgYTD: number | null;
  isPct: boolean;   // true for GP% and Net Operating Profit % rows
  isBold: boolean;  // true for Gross Profit, Operating Profit, Net Income rows
}

export interface ComparativeSnapshotData {
  rows: ComparativeSnapshotRow[];
  currentQLabel: string;        // e.g. "Q4 2025"
  priorYearQLabel: string;      // e.g. "Q4 2024"
  currentMonthLabel: string;    // e.g. "Feb26"
  priorYearMonthLabel: string;  // e.g. "Feb25"
  ytdCurrentLabel: string;      // e.g. "YTD26"
  ytdPriorLabel: string;        // e.g. "YTD25"
}

// ── Rolling 13-Month Income Statement ────────────────────────────────────────

export interface RollingPLRow {
  account: string;       // e.g. "40010 Food Sales", "Total Income"
  rowGroup: string;      // CData RowGroup: "Income", "COGS", "GrossProfit", etc.
  rowType: string;       // "Section" | "Data" | "Summary"
  rowId: string | null;  // null for group totals (e.g. "Total Income"), non-null for sub-totals
  periods: Record<string, number>; // "2024-01" -> value
}

export interface RollingIncomeStatementData {
  months: string[];      // ["2025-02", "2025-03", ..., "2026-02"] — 13 months in order
  monthLabels: string[]; // ["Feb 25", "Mar 25", ..., "Feb 26"]
  rows: RollingPLRow[];
}

export interface KPIs {
  revenueCurrentMo: number;
  revenue3MoAvg: number;
  ytdRevenue: number;
  pyToDateRevenue: number | null;
  yoyRevenueVariance: number | null;
  yoyRevenueVariancePct: number | null;
  grossMarginCurrentMo: number;
  grossMarginYTD: number;
  currentMoNetIncome: number;
  netIncomeYTD: number;
  pyToDateNetIncome: number | null;
  netIncomeYoyVariance: number | null;
}
