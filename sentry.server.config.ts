// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://15a46e4eb0e447613f306485226df69e@o4511464655945728.ingest.us.sentry.io/4511464694415360",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // plan §10: PII는 로그에 남기지 않음. 필요 시 beforeSend 로 명시적 화이트리스트.
  sendDefaultPii: false,
});
