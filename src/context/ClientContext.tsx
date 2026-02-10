"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Client } from '@/lib/types';
import { useBootstrap } from './BootstrapContext';

interface ClientContextValue {
  currentClientId: string | null;  // null = loading, "*" = all clients (internal default)
  currentClient: Client | null;
  clients: Client[];               // Non-empty only for internal users
  isInternal: boolean;
  clientLoading: boolean;
  isImpersonating: boolean;
  authorizedPackageIds: string[] | null; // null = full access; string[] = restricted
  authorizedDashboardIds: string[] | null; // null = full access; string[] = restricted
  setCurrentClientId: (id: string) => void;
  startImpersonating: () => void;
  stopImpersonating: () => void;
}

const ClientContext = createContext<ClientContextValue | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
  const bootstrap = useBootstrap();

  const [currentClientId, setCurrentClientIdRaw] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [isInternal, setIsInternal] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [authorizedPackageIds, setAuthorizedPackageIds] = useState<string[] | null>(null);
  const [authorizedDashboardIds, setAuthorizedDashboardIds] = useState<string[] | null>(null);

  // Auto-clear impersonation when client changes
  const setCurrentClientId = (id: string) => {
    setIsImpersonating(false);
    setCurrentClientIdRaw(id);
    // Refetch bootstrap data for the new client
    bootstrap.refetch(id);
  };

  const startImpersonating = () => {
    if (currentClientId && currentClientId !== '*') {
      setIsImpersonating(true);
    }
  };

  const stopImpersonating = () => {
    setIsImpersonating(false);
  };

  // Sync state from bootstrap data
  useEffect(() => {
    if (bootstrap.loading || !bootstrap.auth) return;

    const auth = bootstrap.auth;
    setIsInternal(auth.isInternal);

    if (auth.isInternal) {
      setClients(bootstrap.clients);
      setAuthorizedPackageIds(null);
      setAuthorizedDashboardIds(null);
      // Only set default clientId on initial load (not on client switch refetch)
      setCurrentClientIdRaw(prev => prev === null ? '*' : prev);
    } else {
      setCurrentClientIdRaw(auth.clientId);
      setAuthorizedPackageIds(auth.authorizedPackageIds ?? null);
      setAuthorizedDashboardIds(auth.authorizedDashboardIds ?? null);
      if (bootstrap.client) {
        setClients([bootstrap.client]);
      }
    }
  }, [bootstrap.loading, bootstrap.auth, bootstrap.clients, bootstrap.client]);

  const currentClient = clients.find(c => c.id === currentClientId) || null;

  return (
    <ClientContext.Provider
      value={{
        currentClientId,
        currentClient,
        clients,
        isInternal,
        clientLoading: bootstrap.loading,
        isImpersonating,
        authorizedPackageIds,
        authorizedDashboardIds,
        setCurrentClientId,
        startImpersonating,
        stopImpersonating,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClient(): ClientContextValue {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error('useClient must be used within a ClientProvider');
  }
  return context;
}
