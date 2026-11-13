import { describe, expect, it } from "vitest";
import { scrubEvent } from "./scrub";

describe("error event scrubbing (S6, G05)", () => {
  it("removes request bodies, cookies, headers, queries, extra data and breadcrumb content", () => {
    const secret = "The Tenant shall pay a deposit of €1,700";
    const event = scrubEvent({
      message: `Failed on: ${secret}`,
      request: {
        url: "https://plainly.app/en/documents/abc?q=secret",
        method: "POST",
        data: { question: secret },
        cookies: { "sb-access-token": "jwt" },
        headers: { authorization: "Bearer x" },
        query_string: "q=secret",
      },
      user: { id: "u1", email: "a@b.c", ip_address: "1.2.3.4" },
      extra: { prompt: secret },
      breadcrumbs: [{ category: "fetch", level: "info", timestamp: 1, message: secret, data: { body: secret } }],
      exception: { values: [{ type: "Error", value: secret }, { type: "Error", value: "ai_failed" }] },
      contexts: { runtime: { name: "node" }, state: { doc: secret } },
    });
    const json = JSON.stringify(event);
    expect(json).not.toContain("1,700");
    expect(json).not.toContain("jwt");
    expect(json).not.toContain("a@b.c");
    expect(json).not.toContain("secret");
    expect(event.request).toEqual({ method: "POST", url: "/en/documents/abc" });
    expect(event.exception?.values?.[1]?.value).toBe("ai_failed");
    expect(event.contexts).toEqual({ runtime: { name: "node" } });
  });
});
