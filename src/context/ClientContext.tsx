"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Client } from '@/lib/types';

interface ClientContextValue {
  currentClientId: string | null;  // null = loading, "*" = all clients (internal default)
  currentClient: Client | null;
  clients: Client[];               // Non-empty only for internal users
  isInternal: boolean;
  clientLoading: boolean;
  setCurrentClientId: (id: string) => void;
}

const ClientContext = createContext<ClientContextValue | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [currentClientId, setCurrentClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [isInternal, setIsInternal] = useState(false);
  const [clientLoading, setClientLoading] = useState(true);

  useEffect(() => {
    async function loadAuthContext() {
      try {
        const res = await fetch('/api/auth/context');
        if (!res.ok) {
          setClientLoading(false);
          return;
        }
        const data = await res.json();
        setIsInternal(data.isInternal);

        if (data.isInternal) {
          setClients(data.clients || []);
          // Default to "*" (all clients) for internal users
          setCurrentClientId('*');
        } else {
          setCurrentClientId(data.clientId);
          if (data.client) {
            setClients([data.client]);
          }
        }
      } catch {
        // Auth context not available — will show as loading
      } finally {
        setClientLoading(false);
      }
    }
    loadAuthContext();
  }, []);

  const currentClient = clients.find(c => c.id === currentClientId) || null;

  return (
    <ClientContext.Provider
      value={{
        currentClientId,
        currentClient,
        clients,
        isInternal,
        clientLoading,
        setCurrentClientId,
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
