import { fetchPLSummaries } from './cdata';
import { getCachedPL, setCachedPL } from './cache';
import { mergePLRows } from './merge';
import { CDataPLRow, ClientConfig } from './types';

async function fetchSingleCompany(catalogId: string, displayName: string, refresh: boolean): Promise<CDataPLRow[]> {
  if (!refresh) {
    try {
      const cached = await getCachedPL(catalogId);
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
    setCachedPL(catalogId, displayName, freshRows).catch((err) =>
      console.error(`Cache write failed for ${catalogId}:`, err)
    );
  }

  return freshRows;
}

export interface FetchPLResult {
  plRows: CDataPLRow[];
  clientName: string;
}

export async function fetchPLForCompanies(
  companyIds: string[],
  clients: ClientConfig[],
  refresh: boolean,
): Promise<FetchPLResult> {
  if (companyIds.length === 1) {
    const client = clients.find(c => c.id === companyIds[0]);
    if (!client) return { plRows: [], clientName: 'Unknown' };
    const plRows = await fetchSingleCompany(client.catalogId, client.displayName, refresh);
    return { plRows, clientName: client.displayName };
  }

  // Multiple companies: resolve UUIDs to catalogIds and fetch in parallel
  const resolvedClients = companyIds
    .map(id => clients.find(c => c.id === id))
    .filter((c): c is ClientConfig => !!c);

  const results = await Promise.all(
    resolvedClients.map(c => fetchSingleCompany(c.catalogId, c.displayName, refresh))
  );

  const nonEmpty = results.filter(r => r.length > 0);
  if (nonEmpty.length === 0) {
    return { plRows: [], clientName: 'Combined' };
  }

  return {
    plRows: mergePLRows(...nonEmpty),
    clientName: 'Combined',
  };
}
