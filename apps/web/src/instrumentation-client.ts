import * as Sentry from "@sentry/nextjs";
import { publicEnv } from "@/shared/config/env";
import { scrubEvent } from "@/shared/lib/scrub";

const dsn = publicEnv().NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // No session replay: it could record document text on screen.
    integrations: [],
    beforeSend: (event) => scrubEvent(event),
  });
}
