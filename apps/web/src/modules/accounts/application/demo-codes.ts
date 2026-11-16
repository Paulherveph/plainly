import { err, ok, type Result } from "@/shared/lib/result";

/**
 * Demo codes (DEMO_SHOW_CODES, docs/TEST_ACCOUNTS.md): the 6-digit sign-up code is returned to the browser
 * instead of emailed, so visitors can try a deployment that sends no email. It changes how the code arrives,
 * never who gets one: a brand-new account, or an unconfirmed account whose password was just proven.
 * Never used for password resets.
 */

export type ProbeResult = "confirmed" | "unconfirmed" | "invalid" | "rate_limited" | "failed";

export interface DemoCodeAuth {
  /** Creates an account that is not confirmed yet. "exists" when the email is taken. Sends no email. */
  createUnconfirmed(
    email: string,
    password: string,
    locale: string,
  ): Promise<"created" | "exists" | "failed">;
  /** Signs in without keeping a session: proves the password and tells whether the email is confirmed. */
  probe(email: string, password: string): Promise<ProbeResult>;
  /** A fresh code for an unconfirmed account (the previous one stops working). Sends no email. */
  signupCode(email: string, password: string): Promise<string | null>;
}

export type DemoCodeError = { kind: "email_exists" | "rate_limited" | "failed" };

export const makeIssueDemoCode =
  (auth: DemoCodeAuth) =>
  async (input: {
    email: string;
    password: string;
    locale: string;
  }): Promise<Result<{ code: string }, DemoCodeError>> => {
    const created = await auth.createUnconfirmed(input.email, input.password, input.locale);
    if (created === "failed") return err({ kind: "failed" });
    if (created === "exists") {
      // An existing account gets a code only when it is unconfirmed AND the password is right.
      const probe = await auth.probe(input.email, input.password);
      if (probe === "rate_limited" || probe === "failed") return err({ kind: probe });
      if (probe !== "unconfirmed") return err({ kind: "email_exists" });
    }
    const code = await auth.signupCode(input.email, input.password);
    return code ? ok({ code }) : err({ kind: "failed" });
  };
