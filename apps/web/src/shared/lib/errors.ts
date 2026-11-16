/** Expected failures, as small tagged unions. Never carry document content. */
export type AppError =
  | { kind: "unauthenticated" }
  | { kind: "not_found" }
  | { kind: "quota_exceeded"; limit: number }
  | { kind: "invalid_input"; reason: InvalidInputReason }
  | { kind: "ai_failed" }
  | { kind: "ai_refused" }
  | { kind: "ai_unavailable" }
  /** The configured model can't read this input (images or scans on a text-only model). */
  | { kind: "ai_unsupported_input" }
  | { kind: "aborted" }
  | { kind: "capacity" }
  | { kind: "rate_limited" }
  | { kind: "concurrency"; limit: number }
  | { kind: "insufficient_credits"; needed: number; available: number }
  | { kind: "page_limit"; max: number }
  | { kind: "file_too_large"; maxBytes: number }
  | { kind: "feature_not_in_plan"; feature: PlanFeature }
  | { kind: "captcha_failed" }
  | { kind: "storage_failed" }
  | { kind: "db_failed" };

export type InvalidInputReason =
  | "unsupported_type"
  | "too_large"
  | "too_many_pages"
  | "empty"
  | "unreadable"
  | "encrypted"
  | "too_short"
  | "too_long";

export type PlanFeature = "deep_chat" | "extra_locale" | "credit_packs";

export type AppErrorKind = AppError["kind"];
