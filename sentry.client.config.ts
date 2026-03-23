import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ec5ce6961dc432a4a3e7f11fc6c30169@o4511091847462912.ingest.us.sentry.io/4511091852181504",
  // 성능 모니터링 샘플링 비율 (프로덕션 환경에서는 조정 권장)
  tracesSampleRate: 1.0,
  debug: false,
  integrations: [
    Sentry.captureConsoleIntegration({
      // 기록할 console 레벨 지정
      levels: ['error'],
    }),
  ],
});
