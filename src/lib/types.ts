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
  slug: string;
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
