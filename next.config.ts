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
    // turbopackUseSystemTlsCerts: true, // macOS 특정 환경에서 지연을 유발할 수 있어 임시 비활성화
  },
};

// [SENTRY] 운영 환경에서만 Sentry를 활성화하여 개발 성능을 보호합니다.
const isProd = process.env.NODE_ENV === 'production';

export default isProd ? withSentryConfig(nextConfig, {
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
    annotateReactComponents: true,

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
