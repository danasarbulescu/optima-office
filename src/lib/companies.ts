export interface CompanyConfig {
  id: string;          // CData catalog name, also the DynamoDB cache key
  displayName: string; // Human-readable label for the UI
}

export const COMPANIES: CompanyConfig[] = [
  { id: 'BrooklynRestaurants', displayName: 'Brooklyn Restaurants' },
  { id: 'NewportAvenueInvestments', displayName: 'Newport Avenue Investments' },
];

export const COMBINED_ID = '__combined__';
export const COMBINED_DISPLAY_NAME = 'Combined';

export function isValidCompanyParam(value: string): boolean {
  return value === COMBINED_ID || COMPANIES.some(c => c.id === value);
}
