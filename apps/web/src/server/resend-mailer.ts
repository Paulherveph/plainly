import "server-only";
import { logError } from "@/shared/lib/log";
import type { Mailer } from "@/shared/lib/mailer";
import { err, ok } from "@/shared/lib/result";

/** Resend over plain fetch (no SDK dependency). */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(input: { to: string; subject: string; text: string }) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from: this.from, to: [input.to], subject: input.subject, text: input.text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        logError("mail.send_failed", { status: res.status });
        return err({ kind: "mail_failed" as const });
      }
      return ok(null);
    } catch {
      logError("mail.send_failed", { status: 0 });
      return err({ kind: "mail_failed" as const });
    }
  }
}
