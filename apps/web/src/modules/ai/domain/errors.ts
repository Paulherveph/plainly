/** Why an AI call ended without a usable value. Never carries prompts or document text. */
export type AiError =
  | { kind: "refused" }
  | { kind: "unavailable" }
  | { kind: "invalid_output" }
  | { kind: "context_too_long" }
  | { kind: "aborted" }
  | { kind: "capacity" };

/** What the gateway does after one failed attempt (docs/AI_PROVIDERS.md section 4). */
export type FailureAction =
  | "next_model" // 429, overloaded, 5xx, network, timeout: next model, mark provider degraded
  | "repair" // invalid structured output: retry once on the same model with the error appended
  | "disable_provider" // 401, 402, 403: disable that provider on this instance, next model
  | "refused" // content refusal: stop, no fallback
  | "context_too_long" // stop, caller switches to retrieval or rejects
  | "aborted"; // the user stopped: stop, record as aborted

export type FailureSignal = {
  aborted: boolean;
  status?: number;
  name?: string;
  message?: string;
  finishReason?: string;
};

export function classifyFailure(s: FailureSignal): FailureAction {
  if (s.aborted) return "aborted";
  if (s.finishReason === "content-filter") return "refused";
  const message = (s.message ?? "").toLowerCase();
  if (s.status === 401 || s.status === 402 || s.status === 403) return "disable_provider";
  if (
    s.status === 413 ||
    message.includes("prompt is too long") ||
    message.includes("context length") ||
    message.includes("context window")
  )
    return "context_too_long";
  if (s.name === "AI_NoObjectGeneratedError" || s.name === "AI_TypeValidationError" || s.name === "AI_JSONParseError")
    return "repair";
  return "next_model";
}

export function terminalError(action: FailureAction): AiError {
  switch (action) {
    case "refused":
      return { kind: "refused" };
    case "context_too_long":
      return { kind: "context_too_long" };
    case "aborted":
      return { kind: "aborted" };
    case "repair":
      return { kind: "invalid_output" };
    default:
      return { kind: "unavailable" };
  }
}
