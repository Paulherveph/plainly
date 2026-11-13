import type { AiAdmission, CreditPort } from "@/modules/analysis/application/ports";
import { ok } from "@/shared/lib/result";
import type { QuotaService } from "../application/ports";

/**
 * S2 bridge: daily quota behind the credit port (reserve = consume, release = refund).
 * Replaced by the credit ledger in S4.
 */
export class QuotaCreditPort implements CreditPort {
  private readonly kinds = new Map<string, "analysis" | "chat">();

  constructor(private readonly quota: QuotaService) {}

  async reserve(input: { userId: string; amount: number; key: string }) {
    const kind = input.key.startsWith("chat:") ? "chat" : "analysis";
    const consumed = await this.quota.consume(kind);
    if (!consumed.ok) return consumed;
    this.kinds.set(input.key, kind);
    return ok({ holdId: input.key });
  }

  async settle(): Promise<void> {}

  async release(holdId: string | null): Promise<void> {
    const kind = holdId ? this.kinds.get(holdId) : undefined;
    if (kind) await this.quota.refund(kind);
  }
}

export const openAdmission: AiAdmission = { admit: async () => ok({ degraded: false }) };
