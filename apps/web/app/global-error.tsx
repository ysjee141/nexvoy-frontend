"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <h1>문제가 발생했어요</h1>
          <p>잠시 후 다시 시도해 주세요.</p>
        </main>
      </body>
    </html>
  );
}
