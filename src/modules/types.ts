import type { NextRequest } from 'next/server';
import type { AuthContext } from '@/lib/types';

export interface ModuleManifest {
  id: string;          // "dashboard", "trend-analysis", "acme-cashflow"
  name: string;        // "Dashboard"
  route: string;       // URL path segment (same as id by convention)
  navLabel: string;    // Nav link text
  navOrder: number;    // Sort order in navigation
}

export type ModuleApiHandler = (
  request: NextRequest,
  auth: AuthContext,
) => Promise<Response>;
