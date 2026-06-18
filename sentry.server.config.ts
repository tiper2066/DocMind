// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Sentry 트라이얼 종료 후 연결 해제 — DSN(env) 이 있을 때만 초기화한다. 복원하려면
// SENTRY_DSN 을 .env 에 다시 넣으면 된다(과거 하드코딩 DSN 은 폐기).
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // plan §10: PII는 로그에 남기지 않음. 필요 시 beforeSend 로 명시적 화이트리스트.
    sendDefaultPii: false,
  });
}
