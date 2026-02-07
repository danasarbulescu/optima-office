import { fetchPLSummaries } from './cdata';
import { getCachedPL, setCachedPL } from './cache';
import { mergePLRows } from './merge';
import { CDataPLRow, ClientConfig } from './types';

async function fetchSingleCompany(companyId: string, refresh: boolean): Promise<CDataPLRow[]> {
  if (!refresh) {
    try {
      const cached = await getCachedPL(companyId);
      if (cached) return cached.plRows;
    } catch (err) {
      console.error(`Cache read failed for ${companyId}, falling back to CData:`, err);
    }
  }

  const freshRows = await fetchPLSummaries(
    process.env.CDATA_USER ?? '',
    process.env.CDATA_PAT ?? '',
    companyId,
  );

  if (freshRows.length > 0) {
    setCachedPL(companyId, companyId, freshRows).catch((err) =>
      console.error(`Cache write failed for ${companyId}:`, err)
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
    const id = companyIds[0];
    const plRows = await fetchSingleCompany(id, refresh);
    const client = clients.find(c => c.id === id);
    return { plRows, clientName: client?.displayName ?? id };
  }

  // Multiple companies: fetch in parallel and merge
  const results = await Promise.all(
    companyIds.map(id => fetchSingleCompany(id, refresh))
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
