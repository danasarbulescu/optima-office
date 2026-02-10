import type { NextConfig } from "next";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const amplifyOutputs = require("./amplify_outputs.json");

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  outputFileTracingRoot: path.join(__dirname),
  env: {
    CDATA_USER: process.env.CDATA_USER,
    CDATA_PAT: process.env.CDATA_PAT,
    CDATA_CATALOG: process.env.CDATA_CATALOG,
    PL_CACHE_TABLE: process.env.PL_CACHE_TABLE || amplifyOutputs?.custom?.plCacheTableName || '',
    ENTITIES_TABLE: process.env.ENTITIES_TABLE || amplifyOutputs?.custom?.entitiesTableName || '',
    CLIENTS_TABLE: process.env.CLIENTS_TABLE || amplifyOutputs?.custom?.clientsTableName || '',
    CLIENT_MEMBERSHIPS_TABLE: process.env.CLIENT_MEMBERSHIPS_TABLE || amplifyOutputs?.custom?.clientMembershipsTableName || '',
    PACKAGES_TABLE: process.env.PACKAGES_TABLE || amplifyOutputs?.custom?.packagesTableName || '',
    DASHBOARDS_TABLE: process.env.DASHBOARDS_TABLE || amplifyOutputs?.custom?.dashboardsTableName || '',
    DASHBOARD_WIDGETS_TABLE: process.env.DASHBOARD_WIDGETS_TABLE || amplifyOutputs?.custom?.dashboardWidgetsTableName || '',
    WIDGET_TYPE_META_TABLE: process.env.WIDGET_TYPE_META_TABLE || amplifyOutputs?.custom?.widgetTypeMetaTableName || '',
    CLIENT_USERS_TABLE: process.env.CLIENT_USERS_TABLE || amplifyOutputs?.custom?.clientUsersTableName || '',
    DATA_SOURCES_TABLE: process.env.DATA_SOURCES_TABLE || amplifyOutputs?.custom?.dataSourcesTableName || '',
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || amplifyOutputs?.auth?.user_pool_id || '',
  },
};

export default nextConfig;
