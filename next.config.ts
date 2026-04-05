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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "nexvoy",

  project: "onvoy",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  // Enables automatic instrumentation of Vercel Cron Monitors.
  automaticVercelMonitors: true,
});
