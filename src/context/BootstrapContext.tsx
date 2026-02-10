"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Client, EntityConfig, Package, Dashboard, DashboardWidget } from '@/lib/types';

interface BootstrapAuth {
  userId: string;
  clientId: string;
  role: string;
  isInternal: boolean;
  authorizedPackageIds: string[] | null;
  authorizedDashboardIds: string[] | null;
}

interface BootstrapContextValue {
  auth: BootstrapAuth | null;
  clients: Client[];
  client: Client | null;
  packages: Package[];
  dashboards: Dashboard[];
  widgetsByDashboard: Record<string, DashboardWidget[]>;
  entities: EntityConfig[];
  loading: boolean;
  refetch: (clientId?: string) => Promise<void>;
}

const BootstrapContext = createContext<BootstrapContextValue | undefined>(undefined);

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<BootstrapAuth | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [widgetsByDashboard, setWidgetsByDashboard] = useState<Record<string, DashboardWidget[]>>({});
  const [entities, setEntities] = useState<EntityConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBootstrap = useCallback(async (clientId?: string) => {
    setLoading(true);
    try {
      const url = clientId
        ? `/api/bootstrap?clientId=${clientId}`
        : '/api/bootstrap';
      const res = await fetch(url);
      if (!res.ok) {
        setAuth(null);
        return;
      }
      const data = await res.json();
      setAuth(data.auth);
      setClients(data.clients || []);
      setClient(data.client || null);
      setPackages(data.packages || []);
      setDashboards(data.dashboards || []);
      setWidgetsByDashboard(data.widgetsByDashboard || {});
      setEntities(data.entities || []);
    } catch {
      // Bootstrap failed — auth state stays null
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial bootstrap on mount
  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  return (
    <BootstrapContext.Provider
      value={{
        auth,
        clients,
        client,
        packages,
        dashboards,
        widgetsByDashboard,
        entities,
        loading,
        refetch: fetchBootstrap,
      }}
    >
      {children}
    </BootstrapContext.Provider>
  );
}

export function useBootstrap(): BootstrapContextValue {
  const context = useContext(BootstrapContext);
  if (!context) {
    throw new Error('useBootstrap must be used within a BootstrapProvider');
  }
  return context;
}
