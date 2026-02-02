import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  env: {
    CDATA_USER: process.env.CDATA_USER,
    CDATA_PAT: process.env.CDATA_PAT,
    CDATA_CATALOG: process.env.CDATA_CATALOG,
  },
};

export default nextConfig;
