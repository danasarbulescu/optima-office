import { DataAdapter } from './base';
import { QuickBooksAdapter } from './quickbooks';

export function getAdapter(provider: string): DataAdapter {
  switch (provider) {
    case 'quickbooks':
      return new QuickBooksAdapter();
    default:
      throw new Error(`Unknown data provider: ${provider}`);
  }
}

export type { DataAdapter, DataSourceCredentials } from './base';
