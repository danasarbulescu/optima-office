"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { EntityConfig } from '@/lib/types';
import { useClient } from './ClientContext';

interface EntityContextValue {
  entities: EntityConfig[];
  entitiesLoading: boolean;
  selectedEntities: string[];
  setSelectedEntities: (ids: string[]) => void;
  refreshEntities: () => void;
}

const EntityContext = createContext<EntityContextValue | undefined>(undefined);

export function EntityProvider({ children }: { children: ReactNode }) {
  const { currentClientId, clientLoading } = useClient();
  const [entities, setEntities] = useState<EntityConfig[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(true);
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  const fetchEntities = useCallback(async () => {
    if (!currentClientId) return;
    setEntitiesLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (currentClientId !== '*') {
        headers['x-client-id'] = currentClientId;
      }
      const res = await fetch('/api/entities', { headers });
      if (!res.ok) return;
      const data = await res.json();
      const fetched: EntityConfig[] = data.entities;
      setEntities(fetched);
      // Default: select all entities on first load
      setSelectedEntities((prev) =>
        prev.length === 0 ? fetched.map((e) => e.id) : prev
      );
    } catch {
      // silently fail — entities page will show error
    } finally {
      setEntitiesLoading(false);
    }
  }, [currentClientId]);

  // Re-fetch entities when client changes
  useEffect(() => {
    if (!clientLoading && currentClientId) {
      setSelectedEntities([]);
      fetchEntities();
    }
  }, [currentClientId, clientLoading, fetchEntities]);

  return (
    <EntityContext.Provider
      value={{
        entities,
        entitiesLoading: entitiesLoading || clientLoading,
        selectedEntities,
        setSelectedEntities,
        refreshEntities: fetchEntities,
      }}
    >
      {children}
    </EntityContext.Provider>
  );
}

export function useEntity(): EntityContextValue {
  const context = useContext(EntityContext);
  if (!context) {
    throw new Error('useEntity must be used within an EntityProvider');
  }
  return context;
}
