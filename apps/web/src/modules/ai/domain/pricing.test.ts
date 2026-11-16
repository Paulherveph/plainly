import { describe, expect, it } from "vitest";
import { costMicros, PRICES, parseModelRef, priceFor } from "./pricing";

describe("pricing", () => {
  it("parses provider:model references and rejects unknown providers", () => {
    expect(parseModelRef("anthropic:claude-haiku-5-5")).toEqual({
      provider: "anthropic",
      model: "claude-haiku-5-5",
    });
    expect(parseModelRef("acme:model")).toBeNull();
    expect(parseModelRef("anthropic:")).toBeNull();
  });

  it("applies the cache formula from TOKEN_ECONOMY section 6", () => {
    const price = {
      inputPerM: 2,
      outputPerM: 10,
      cacheWritePerM: 2.5,
      cacheReadPerM: 0.1,
      verifiedOn: "x",
      evalPassedOn: null,
    };
    // 1000 input of which 600 cache read and 200 cache write; 100 output.
    const micros = costMicros(
      { inputTokens: 1000, cacheReadTokens: 600, cacheWriteTokens: 200, outputTokens: 100 },
      price,
    );
    expect(micros).toBe(200 * 2 + 200 * 2.5 + 600 * 0.1 + 100 * 10);
  });

  it("has a non-zero price for every listed model", () => {
    for (const [key, price] of Object.entries(PRICES)) {
      expect(price.inputPerM, key).toBeGreaterThan(0);
      expect(price.outputPerM, key).toBeGreaterThan(0);
      expect(price.verifiedOn, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(priceFor({ provider: "anthropic", model: "unknown" })).toBeNull();
  });
});

describe("privacy provider list (G07)", () => {
  it("names exactly the enabled providers", async () => {
    const { providerList } = await import("./pricing");
    expect(providerList(["anthropic"])).toBe("Anthropic (Claude)");
    expect(providerList([])).toBe("");
  });
});
