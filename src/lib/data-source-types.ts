export interface DataSourceTypeField {
  key: string;
  label: string;
  sensitive?: boolean;
  placeholder?: string;
}

export interface DataSourceTypeConfig {
  displayName: string;
  fields: DataSourceTypeField[];
}

export const DATA_SOURCE_TYPES: Record<string, DataSourceTypeConfig> = {
  cdata: {
    displayName: 'CData Connect Cloud',
    fields: [
      { key: 'user', label: 'Username', placeholder: 'e.g. user@company.com' },
      { key: 'pat', label: 'Personal Access Token', sensitive: true },
    ],
  },
};

export function getDataSourceTypeConfig(type: string): DataSourceTypeConfig | undefined {
  return DATA_SOURCE_TYPES[type];
}
