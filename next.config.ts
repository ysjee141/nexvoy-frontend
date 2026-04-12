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
    turbopackUseSystemTlsCerts: process.env.NODE_ENV === 'production', // macOS 특정 환경에서 지연을 유발할 수 있어 임시 비활성화
  },
};

// [SENTRY] 운영 환경에서만 Sentry를 활성화하며, 모바일 빌드(static export)에서는 비활성화합니다.
// tunnelRoute 등 서버 전용 기능이 output: 'export'와 충돌하기 때문입니다.
const isProd = process.env.NODE_ENV === 'production';
const enableSentry = isProd && !isMobileBuild;

export default enableSentry ? withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "travel-pack",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (can increase build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  // annotateReactComponents: true,

  // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // See : https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#use-the-sentry-cron-monitor-feature
  tunnelRoute: "/monitoring",

  // Hides source maps from visitors
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not authorize)
  // See the following for more information:
  // https://sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
}) : nextConfig;
