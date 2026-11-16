import { describe, expect, it } from "vitest";
import { type DemoCodeAuth, makeIssueDemoCode, type ProbeResult } from "./demo-codes";

/** A fake Supabase: one optional existing account, its password and whether it is confirmed. */
function fakeAuth(existing?: { password: string; confirmed: boolean; probe?: ProbeResult }) {
  const calls: string[] = [];
  const auth: DemoCodeAuth = {
    async createUnconfirmed() {
      calls.push("create");
      return existing ? "exists" : "created";
    },
    async probe(_email, password) {
      calls.push("probe");
      if (!existing) return "invalid";
      if (existing.probe) return existing.probe;
      if (password !== existing.password) return "invalid";
      return existing.confirmed ? "confirmed" : "unconfirmed";
    },
    async signupCode() {
      calls.push("code");
      return "123456";
    },
  };
  return { issue: makeIssueDemoCode(auth), calls };
}

const input = { email: "ada@example.com", password: "right-password", locale: "en" };

describe("demo codes: who gets a code on screen", () => {
  it("a new email gets a code, without the rate-limited password check", async () => {
    const { issue, calls } = fakeAuth();
    expect(await issue(input)).toEqual({ ok: true, value: { code: "123456" } });
    expect(calls).toEqual(["create", "code"]);
  });

  it("an unconfirmed account with the right password gets a fresh code", async () => {
    const { issue } = fakeAuth({ password: "right-password", confirmed: false });
    expect(await issue(input)).toEqual({ ok: true, value: { code: "123456" } });
  });

  it("an unconfirmed account with a wrong password gets no code", async () => {
    const { issue, calls } = fakeAuth({ password: "owner-password", confirmed: false });
    expect(await issue(input)).toEqual({ ok: false, error: { kind: "email_exists" } });
    expect(calls).not.toContain("code");
  });

  it("a confirmed account never gets a code, even with the right password", async () => {
    const { issue, calls } = fakeAuth({ password: "right-password", confirmed: true });
    expect(await issue(input)).toEqual({ ok: false, error: { kind: "email_exists" } });
    expect(calls).not.toContain("code");
  });

  it("passes rate limits and failures through instead of guessing", async () => {
    const limited = fakeAuth({ password: "x", confirmed: false, probe: "rate_limited" });
    expect(await limited.issue(input)).toEqual({ ok: false, error: { kind: "rate_limited" } });
    const failed = fakeAuth({ password: "x", confirmed: false, probe: "failed" });
    expect(await failed.issue(input)).toEqual({ ok: false, error: { kind: "failed" } });
  });
});
