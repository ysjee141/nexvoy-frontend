import { withSentryConfig } from '@sentry/nextjs';
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

export default withSentryConfig(
  nextConfig,
  {
    // 소스맵 업로드 시 로그 숨김 여부
    silent: true,
    org: "your-organization",
    project: "your-project",
  },
  {
    widenClientFileUpload: true,
    transpileClientSDK: true,
    hideSourceMaps: true,
    disableLogger: true,
    automaticVercelMonitors: true,
  }
);
