"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ClientConfig } from '@/lib/types';

interface CompanyContextValue {
  clients: ClientConfig[];
  clientsLoading: boolean;
  selectedCompanies: string[];
  setSelectedCompanies: (ids: string[]) => void;
  refreshClients: () => void;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<ClientConfig[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      if (!res.ok) return;
      const data = await res.json();
      const fetched: ClientConfig[] = data.clients;
      setClients(fetched);
      // Default: select all clients on first load
      setSelectedCompanies((prev) =>
        prev.length === 0 ? fetched.map((c) => c.id) : prev
      );
    } catch {
      // silently fail — clients page will show error
    } finally {
      setClientsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return (
    <CompanyContext.Provider
      value={{
        clients,
        clientsLoading,
        selectedCompanies,
        setSelectedCompanies,
        refreshClients: fetchClients,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
