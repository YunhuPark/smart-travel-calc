import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.BUILD_MOBILE === 'true' ? 'export' : undefined,
};

export default nextConfig;
