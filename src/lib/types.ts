import { FinancialRow } from './models/financial';

export interface EntityConfig {
  id: string;          // Internal UUID (DynamoDB partition key)
  clientId: string;    // Client this entity belongs to
  catalogId: string;   // CData catalog name (e.g. "BrooklynRestaurants")
  displayName: string; // Human-readable label for the UI
  createdAt?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface Client {
  id: string;
  slug: string;
  displayName: string;
  createdAt: string;
}

export type ClientRole = 'internal-admin' | 'client-admin' | 'client-viewer';

export interface ClientMembership {
  userId: string;       // Cognito sub
  clientId: string;     // "*" = internal (all clients)
  role: ClientRole;
}

export interface AuthContext {
  userId: string;
  clientId: string;     // Resolved client (for internal, the currently-selected one)
  role: ClientRole;
  isInternal: boolean;  // true if clientId === "*"
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
