export interface DataSourceTypeField {
  key: string;
  label: string;
  sensitive?: boolean;
  placeholder?: string;
}

export interface DataSourceTypeConfig {
  displayName: string;
  fields: DataSourceTypeField[];        // connection-level (username, PAT)
  entityFields: DataSourceTypeField[];  // entity-level (catalog ID, etc.)
}

export const DATA_SOURCE_TYPES: Record<string, DataSourceTypeConfig> = {
  cdata: {
    displayName: 'CData Connect Cloud',
    fields: [
      { key: 'user', label: 'Username', placeholder: 'e.g. user@company.com' },
      { key: 'pat', label: 'Personal Access Token', sensitive: true },
    ],
    entityFields: [
      { key: 'catalogId', label: 'Catalog ID', placeholder: 'e.g. BrooklynRestaurants' },
    ],
  },
};

export function getDataSourceTypeConfig(type: string): DataSourceTypeConfig | undefined {
  return DATA_SOURCE_TYPES[type];
}
