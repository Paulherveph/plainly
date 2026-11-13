/** Expected failures, as small tagged unions. Never carry document content. */
export type AppError =
  | { kind: "unauthenticated" }
  | { kind: "not_found" }
  | { kind: "quota_exceeded"; limit: number }
  | { kind: "invalid_input"; reason: InvalidInputReason }
  | { kind: "ai_failed" }
  | { kind: "storage_failed" }
  | { kind: "db_failed" };

export type InvalidInputReason = "unsupported_type" | "too_large" | "too_many_pages" | "empty" | "unreadable";
