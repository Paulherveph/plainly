import { describe, expect, it } from "vitest";
import { checkAction, Entitlements, extraLocaleCost, tierOf } from "./entitlements";

const free = Entitlements.parse({ credits: 24, maxPages: 10, maxBytes: 10_485_760, deepChat: false });
const pro = Entitlements.parse({ credits: 400, maxPages: 40, maxBytes: 20_971_520, deepChat: true, allLocales: true });

describe("entitlements", () => {
  it("A08/A09: file size and page limits come from the plan", () => {
    expect(checkAction({ kind: "upload", pages: 12, bytes: 1000 }, free, 24)).toEqual({
      ok: false,
      error: { kind: "page_limit", max: 10 },
    });
    expect(checkAction({ kind: "upload", pages: 1, bytes: 11_000_000 }, free, 24)).toEqual({
      ok: false,
      error: { kind: "file_too_large", maxBytes: 10_485_760 },
    });
    expect(checkAction({ kind: "upload", pages: 12, bytes: 1000 }, pro, 0).ok).toBe(true);
  });

  it("C15: deep chat on Free is feature_not_in_plan", () => {
    expect(checkAction({ kind: "chat", deep: true, credits: 3 }, free, 24)).toEqual({
      ok: false,
      error: { kind: "feature_not_in_plan", feature: "deep_chat" },
    });
    expect(checkAction({ kind: "chat", deep: true, credits: 3 }, pro, 400).ok).toBe(true);
  });

  it("F03: not enough credits shows the cost and the balance", () => {
    expect(checkAction({ kind: "analysis", credits: 5 }, free, 2)).toEqual({
      ok: false,
      error: { kind: "insufficient_credits", needed: 5, available: 2 },
    });
  });

  it("B16: extra locales are included on Pro and cost 1 credit on Free", () => {
    expect(extraLocaleCost(pro, 1)).toBe(0);
    expect(extraLocaleCost(free, 1)).toBe(1);
  });

  it("maps plans to budget tiers", () => {
    expect(tierOf("guest")).toBe("guest");
    expect(tierOf("free")).toBe("free");
    expect(tierOf("pro_year")).toBe("paid");
  });
});
