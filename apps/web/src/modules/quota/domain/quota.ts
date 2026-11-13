export type QuotaKind = "analysis" | "chat";

/** Daily limits (PRD F10). Mirrored in the consume_quota() SQL function, which is the source of truth. */
export const DAILY_LIMITS: Record<QuotaKind, { guest: number; member: number }> = {
  analysis: { guest: 5, member: 20 },
  chat: { guest: 30, member: 100 },
};

export type QuotaStatus = { used: number; limit: number; remaining: number };

export function limitFor(kind: QuotaKind, isAnonymous: boolean): number {
  return isAnonymous ? DAILY_LIMITS[kind].guest : DAILY_LIMITS[kind].member;
}
