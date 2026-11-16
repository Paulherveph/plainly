import { describe, expect, it } from "vitest";
import { ServerEnv } from "./env";

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54325",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  NODE_ENV: "development",
};
const OLLAMA_ONLY = {
  AI_PROVIDERS_ALLOWED: "ollama",
  AI_PROFILE_ANALYSIS: "ollama:qwen3:8b",
  AI_PROFILE_CHAT: "ollama:qwen3:8b",
  AI_PROFILE_CHAT_DEEP: "ollama:qwen3:8b",
  AI_PROFILE_FAST: "ollama:qwen3:8b",
  AI_PROFILE_TRANSLATE: "ollama:qwen3:8b",
};
const issuePaths = (input: object) => {
  const parsed = ServerEnv.safeParse({ ...BASE, ...input });
  return parsed.success ? [] : parsed.error.issues.map((i) => i.path.join("."));
};

describe("server env: AI providers", () => {
  it("accepts local Ollama with no key and defaults the URL", () => {
    const parsed = ServerEnv.safeParse({ ...BASE, ...OLLAMA_ONLY });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.OLLAMA_BASE_URL).toBe("http://localhost:11434/v1");
    expect(parsed.data?.AI_PROFILE_ANALYSIS).toEqual([{ provider: "ollama", model: "qwen3:8b" }]);
  });

  it("requires OLLAMA_API_KEY for Ollama Cloud", () => {
    expect(issuePaths({ ...OLLAMA_ONLY, OLLAMA_BASE_URL: "https://ollama.com/v1" })).toEqual([
      "OLLAMA_API_KEY",
    ]);
    expect(
      issuePaths({ ...OLLAMA_ONLY, OLLAMA_BASE_URL: "https://ollama.com/v1", OLLAMA_API_KEY: "k" }),
    ).toEqual([]);
  });

  it("requires ANTHROPIC_API_KEY only when a profile uses Anthropic", () => {
    expect(issuePaths({})).toEqual(["ANTHROPIC_API_KEY"]);
    expect(issuePaths({ ANTHROPIC_API_KEY: "k" })).toEqual([]);
    expect(issuePaths({ USE_FAKE_AI: "true" })).toEqual([]);
  });

  it("requires the Grok and Gemini keys only for their own models", () => {
    expect(issuePaths({ AI_MODEL: "xai:grok-4.7" })).toEqual(["XAI_API_KEY"]);
    expect(issuePaths({ AI_MODEL: "xai:grok-4.7", XAI_API_KEY: "k" })).toEqual([]);
    expect(issuePaths({ AI_MODEL: "google:gemini-3.8-flash" })).toEqual(["GEMINI_API_KEY"]);
    expect(issuePaths({ AI_MODEL: "google:gemini-3.8-flash", GEMINI_API_KEY: "k" })).toEqual([]);
    expect(issuePaths({ AI_MODEL: "xai:grok-unknown", XAI_API_KEY: "k" }).length).toBeGreaterThan(0);
  });

  it("parses the timeout override", () => {
    const parsed = ServerEnv.safeParse({ ...BASE, ...OLLAMA_ONLY, AI_TIMEOUT_MS: "600000" });
    expect(parsed.data?.AI_TIMEOUT_MS).toBe(600_000);
  });

  it("AI_MODEL fills every unset profile and picks the provider", () => {
    const parsed = ServerEnv.safeParse({ ...BASE, AI_MODEL: "ollama:llama3.2:3b" });
    const ref = [{ provider: "ollama", model: "llama3.2:3b" }];
    expect(parsed.success).toBe(true);
    expect(parsed.data?.AI_PROFILE_ANALYSIS).toEqual(ref);
    expect(parsed.data?.AI_PROFILE_TRANSLATE).toEqual(ref);
    expect(parsed.data?.AI_PROVIDERS_ALLOWED).toEqual(["ollama"]);
  });

  it("lets an explicit profile override AI_MODEL", () => {
    const parsed = ServerEnv.safeParse({
      ...BASE,
      AI_MODEL: "ollama:llama3.2:3b",
      AI_PROFILE_ANALYSIS: "anthropic:claude-sonnet-5-5,ollama:llama3.2:3b",
      ANTHROPIC_API_KEY: "k",
    });
    expect(parsed.data?.AI_PROFILE_ANALYSIS.map((r) => r.provider)).toEqual(["anthropic", "ollama"]);
    expect(parsed.data?.AI_PROFILE_CHAT).toEqual([{ provider: "ollama", model: "llama3.2:3b" }]);
    expect(parsed.data?.AI_PROVIDERS_ALLOWED).toEqual(["anthropic", "ollama"]);
  });

  it("keeps an explicit AI_PROVIDERS_ALLOWED as an allow-list", () => {
    expect(issuePaths({ AI_MODEL: "ollama:llama3.2:3b", AI_PROVIDERS_ALLOWED: "anthropic" })).toContain(
      "AI_PROVIDERS_ALLOWED",
    );
  });
});
