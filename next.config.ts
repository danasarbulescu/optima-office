import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  outputFileTracingRoot: path.join(__dirname),
  env: {
    CDATA_USER: process.env.CDATA_USER,
    CDATA_PAT: process.env.CDATA_PAT,
    CDATA_CATALOG: process.env.CDATA_CATALOG,
    PL_CACHE_TABLE: process.env.PL_CACHE_TABLE,
  },
};

export default nextConfig;
