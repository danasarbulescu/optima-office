import { fetchPLSummaries } from './cdata';
import { getCachedPL, setCachedPL } from './cache';
import { mergePLRows } from './merge';
import { CDataPLRow, EntityConfig } from './types';

async function fetchSingleEntity(clientId: string, catalogId: string, displayName: string, refresh: boolean): Promise<CDataPLRow[]> {
  if (!refresh) {
    try {
      const cached = await getCachedPL(clientId, catalogId);
      if (cached) return cached.plRows;
    } catch (err) {
      console.error(`Cache read failed for ${catalogId}, falling back to CData:`, err);
    }
  }

  const freshRows = await fetchPLSummaries(
    process.env.CDATA_USER ?? '',
    process.env.CDATA_PAT ?? '',
    catalogId,
  );

  if (freshRows.length > 0) {
    setCachedPL(clientId, catalogId, displayName, freshRows).catch((err) =>
      console.error(`Cache write failed for ${catalogId}:`, err)
    );
  }

  return freshRows;
}

export interface FetchPLResult {
  plRows: CDataPLRow[];
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
    if (!entity) return { plRows: [], entityName: 'Unknown' };
    const plRows = await fetchSingleEntity(clientId, entity.catalogId, entity.displayName, refresh);
    return { plRows, entityName: entity.displayName };
  }

  // Multiple entities: resolve UUIDs to catalogIds and fetch in parallel
  const resolvedEntities = entityIds
    .map(id => entities.find(e => e.id === id))
    .filter((e): e is EntityConfig => !!e);

  const results = await Promise.all(
    resolvedEntities.map(e => fetchSingleEntity(clientId, e.catalogId, e.displayName, refresh))
  );

  const nonEmpty = results.filter(r => r.length > 0);
  if (nonEmpty.length === 0) {
    return { plRows: [], entityName: 'Combined' };
  }

  return {
    plRows: mergePLRows(...nonEmpty),
    entityName: 'Combined',
  };
}
