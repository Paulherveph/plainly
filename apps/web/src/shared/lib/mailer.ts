import type { Result } from "./result";

/** Transactional email (alerts, account deletion). Plain text only; never document content. */
export interface Mailer {
  send(input: { to: string; subject: string; text: string }): Promise<Result<null, { kind: "mail_failed" }>>;
}
