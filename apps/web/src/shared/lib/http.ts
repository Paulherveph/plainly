import type { AppError } from "./errors";

/** HTTP status for a typed error. The body only ever carries the error kind and numbers. */
export function httpStatus(kind: AppError["kind"]): number {
  switch (kind) {
    case "unauthenticated":
    case "captcha_failed":
      return 401;
    case "insufficient_credits":
    case "feature_not_in_plan":
      return 402;
    case "not_found":
      return 404;
    case "page_limit":
    case "file_too_large":
      return 413;
    case "invalid_input":
      return 400;
    case "quota_exceeded":
    case "rate_limited":
    case "concurrency":
      return 429;
    case "capacity":
    case "ai_unavailable":
      return 503;
    case "aborted":
      return 499;
    default:
      return 500;
  }
}

/** I03: reject oversized JSON bodies before parsing them. */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return null;
  const text = await request.text().catch(() => "");
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Non-sensitive numbers a paywall or limit message needs. */
export function errorDetail(error: AppError): Record<string, number | string> {
  const { kind: _kind, ...rest } = error as AppError & Record<string, unknown>;
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(rest)) if (typeof v === "number" || typeof v === "string") out[k] = v;
  return out;
}
