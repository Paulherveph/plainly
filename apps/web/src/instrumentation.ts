import * as Sentry from "@sentry/nextjs";
import { serverEnv } from "@/shared/config/env";
import { scrubEvent } from "@/shared/lib/scrub";

/** Error tracking only when SENTRY_DSN is set. No PII, no request bodies, no content (scrubbed). */
export async function register() {
  const dsn = serverEnv().SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.05,
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
  });
}

export const onRequestError = Sentry.captureRequestError;
