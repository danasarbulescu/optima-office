import { getAdapter } from './adapters';
import { getCachedPL, setCachedPL } from './cache';
import { getDataSource } from './data-sources';
import { mergeFinancialRows } from './merge';
import { FinancialRow } from './models/financial';
import { EntityConfig } from './types';

async function fetchSingleEntity(
  clientId: string,
  catalogId: string,
  displayName: string,
  refresh: boolean,
  dataSourceId?: string,
): Promise<FinancialRow[]> {
  if (!refresh) {
    try {
      const cached = await getCachedPL(clientId, catalogId);
      if (cached) return cached.rows;
    } catch (err) {
      console.error(`Cache read failed for ${catalogId}, falling back to CData:`, err);
    }
  }

  // Resolve adapter type + credentials from the entity's data source (or env var defaults)
  let adapterType = 'quickbooks';
  let credentials = {
    user: process.env.CDATA_USER ?? '',
    pat: process.env.CDATA_PAT ?? '',
  };

  if (dataSourceId) {
    const ds = await getDataSource(dataSourceId);
    if (ds && ds.status === 'active') {
      adapterType = ds.type === 'cdata' ? 'quickbooks' : ds.type;
      credentials = {
        user: ds.config.user ?? '',
        pat: ds.config.pat ?? '',
      };
    }
  }

  const adapter = getAdapter(adapterType);
  const freshRows = await adapter.fetchFinancialData(catalogId, credentials);

  if (freshRows.length > 0) {
    setCachedPL(clientId, catalogId, displayName, freshRows).catch((err) =>
      console.error(`Cache write failed for ${catalogId}:`, err)
    );
  }

  return freshRows;
}

export interface FetchPLResult {
  rows: FinancialRow[];
  entityName: string;
}

export async function fetchPLForEntities(
  clientId: string,
  entityIds: string[],
  entities: EntityConfig[],
  refresh: boolean,
): Promise<FetchPLResult> {
  if (entityIds.length === 1) {
    const entity = entities.find(e => e.id === entityIds[0]);
    if (!entity) return { rows: [], entityName: 'Unknown' };
    const rows = await fetchSingleEntity(clientId, entity.catalogId, entity.displayName, refresh, entity.dataSourceId);
    return { rows, entityName: entity.displayName };
  }

  // Multiple entities: resolve UUIDs to catalogIds and fetch in parallel
  const resolvedEntities = entityIds
    .map(id => entities.find(e => e.id === id))
    .filter((e): e is EntityConfig => !!e);

  const results = await Promise.all(
    resolvedEntities.map(e => fetchSingleEntity(clientId, e.catalogId, e.displayName, refresh, e.dataSourceId))
  );

  const nonEmpty = results.filter(r => r.length > 0);
  if (nonEmpty.length === 0) {
    return { rows: [], entityName: 'Combined' };
  }

  return {
    rows: mergeFinancialRows(...nonEmpty),
    entityName: 'Combined',
  };
}
