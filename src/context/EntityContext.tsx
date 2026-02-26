"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { EntityConfig } from '@/lib/types';
import { useClient } from './ClientContext';
import { useBootstrap } from './BootstrapContext';

interface EntityContextValue {
  entities: EntityConfig[];
  entitiesLoading: boolean;
  selectedEntities: string[];
  setSelectedEntities: (ids: string[]) => void;
  refreshEntities: () => void;
}

const EntityContext = createContext<EntityContextValue | undefined>(undefined);

export function EntityProvider({ children }: { children: ReactNode }) {
  const { currentClientId, clientLoading, authorizedEntityIds } = useClient();
  const bootstrap = useBootstrap();
  const [entities, setEntities] = useState<EntityConfig[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const prevClientId = useRef<string | null>(null);

  // Sync entities from bootstrap data, filtered by authorization
  useEffect(() => {
    if (bootstrap.loading || clientLoading) return;

    // Filter entities by authorization (null = full access)
    const fetched = authorizedEntityIds
      ? bootstrap.entities.filter(e => authorizedEntityIds.includes(e.id))
      : bootstrap.entities;
    setEntities(fetched);

    // Reset selection when client changes, default to all on first load
    if (currentClientId !== prevClientId.current) {
      prevClientId.current = currentClientId;
      setSelectedEntities(fetched.map(e => e.id));
    } else {
      // Keep current selection but default to all if empty
      setSelectedEntities(prev =>
        prev.length === 0 ? fetched.map(e => e.id) : prev
      );
    }
  }, [bootstrap.loading, bootstrap.entities, clientLoading, currentClientId, authorizedEntityIds]);

  return (
    <EntityContext.Provider
      value={{
        entities,
        entitiesLoading: bootstrap.loading || clientLoading,
        selectedEntities,
        setSelectedEntities,
        refreshEntities: () => bootstrap.refetch(),
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
