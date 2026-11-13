import { describe, expect, it } from "vitest";
import { classifyFailure } from "./errors";

describe("classifyFailure (AI_PROVIDERS section 4)", () => {
  it.each([
    [{ aborted: false, status: 429 }, "next_model"],
    [{ aborted: false, status: 529 }, "next_model"],
    [{ aborted: false, status: 500 }, "next_model"],
    [{ aborted: false, name: "TypeError", message: "fetch failed" }, "next_model"],
    [{ aborted: false, status: 401 }, "disable_provider"],
    [{ aborted: false, status: 402 }, "disable_provider"],
    [{ aborted: false, status: 400, message: "prompt is too long: 300000 tokens" }, "context_too_long"],
    [{ aborted: false, name: "AI_NoObjectGeneratedError" }, "repair"],
    [{ aborted: false, finishReason: "content-filter" }, "refused"],
    [{ aborted: true, status: 500 }, "aborted"],
  ] as const)("%o -> %s", (signal, action) => {
    expect(classifyFailure(signal)).toBe(action);
  });
});
