/**
 * Error events must never carry document text, prompts, answers, cookies or tokens
 * (docs/SCALING.md section 5). This keeps error types, stack frames, route and release, and drops
 * everything else. Used as Sentry `beforeSend` and `beforeSendTransaction`.
 */
type Frame = { filename?: string; function?: string; lineno?: number; colno?: number; in_app?: boolean };
type ScrubbableEvent = {
  message?: unknown;
  request?: { url?: string; method?: string; data?: unknown; cookies?: unknown; headers?: unknown; query_string?: unknown };
  user?: { id?: string } & Record<string, unknown>;
  extra?: unknown;
  breadcrumbs?: { category?: string; level?: string; timestamp?: number; message?: unknown; data?: unknown }[];
  exception?: { values?: { type?: string; value?: string; stacktrace?: { frames?: Frame[] } }[] };
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
};

const SAFE_VALUE = /^[a-z_]{2,40}$/;
const KEEP_CONTEXTS = new Set(["runtime", "os", "browser", "device", "trace", "app", "response"]);

export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  if (event.request) {
    const path = safePath(event.request.url);
    event.request = { method: event.request.method, ...(path ? { url: path } : {}) };
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
  delete event.extra;
  if (typeof event.message === "string" && !SAFE_VALUE.test(event.message)) event.message = "[scrubbed]";
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({ category: b.category, level: b.level, timestamp: b.timestamp }));
  }
  for (const value of event.exception?.values ?? []) {
    // Our own errors carry only error kinds (snake_case); anything else may contain content.
    if (value.value && !SAFE_VALUE.test(value.value)) value.value = "[scrubbed]";
  }
  if (event.contexts) {
    for (const key of Object.keys(event.contexts)) if (!KEEP_CONTEXTS.has(key)) delete event.contexts[key];
  }
  return event;
}

/** Keeps the path only; UUIDs stay (they are opaque ids), query strings go. */
function safePath(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url, "https://x.invalid").pathname;
  } catch {
    return null;
  }
}
