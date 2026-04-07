import * as SentryNext from "@sentry/nextjs";
import * as SentryCapacitor from "@sentry/capacitor";
import { Capacitor } from "@capacitor/core";

const dsn = "https://ec5ce6961dc432a4a3e7f11fc6c30169@o4511091847462912.ingest.us.sentry.io/4511091852181504";

if (Capacitor.isNativePlatform()) {
  // 모바일 앱 환경 구동 시: 네이티브 크래시 리포트를 위해 Capacitor 특화 버전을 사용
  SentryCapacitor.init({
    dsn,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
    debug: false,
  });
} else {
  // 브라우저 웹 환경 구동 시: 기존 Next.js Sentry 설정 유지
  SentryNext.init({
    dsn,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
    debug: false,
    integrations: [
      SentryNext.captureConsoleIntegration({
        levels: ['error'], // 브라우저 콘솔 에러 수집
      }),
    ],
  });
}
