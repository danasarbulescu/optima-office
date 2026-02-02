import { defineFunction, secret } from '@aws-amplify/backend';

export const dashboardApi = defineFunction({
  name: 'dashboard-api',
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    CDATA_USER: secret('CDATA_USER'),
    CDATA_PAT: secret('CDATA_PAT'),
    CDATA_CATALOG: secret('CDATA_CATALOG'),
  },
});
