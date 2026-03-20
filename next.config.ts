import type { NextConfig } from "next";

const isMobileBuild = process.env.BUILD_TARGET === 'mobile';

const nextConfig: NextConfig = {
  /* config options here */
  output: isMobileBuild ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: isMobileBuild ? true : undefined,
  },
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
