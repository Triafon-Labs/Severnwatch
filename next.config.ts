import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  env: {
    // Surfaced in the settings sheet's About section. Read from npm's own
    // env at build time rather than by importing package.json, which would
    // pull the whole manifest into the client bundle.
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
  },
};

export default nextConfig;
