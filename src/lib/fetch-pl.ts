import { fetchPLSummaries } from './cdata';
import { getCachedPL, setCachedPL } from './cache';
import { mergePLRows } from './merge';
import { CDataPLRow } from './types';
import { COMPANIES, COMBINED_ID } from './companies';

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

export async function fetchPLForCompany(companyParam: string, refresh: boolean): Promise<FetchPLResult> {
  if (companyParam === COMBINED_ID) {
    const results = await Promise.all(
      COMPANIES.map(c => fetchSingleCompany(c.id, refresh))
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

  const plRows = await fetchSingleCompany(companyParam, refresh);
  const company = COMPANIES.find(c => c.id === companyParam);
  return { plRows, clientName: company?.displayName ?? companyParam };
}
