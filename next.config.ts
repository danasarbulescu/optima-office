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
    CLIENTS_TABLE: process.env.CLIENTS_TABLE || amplifyOutputs?.custom?.clientsTableName || '',
  },
};

export default nextConfig;
