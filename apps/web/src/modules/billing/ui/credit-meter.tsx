"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/shared/i18n/navigation";
import type { CreditBalance } from "../application/ports";

/** Small ring plus the number of credits left; the title shows the reset date. */
export function CreditMeter({ balance, variant = "ring" }: { balance: CreditBalance; variant?: "ring" | "inline" }) {
  const t = useTranslations("Billing");
  const format = useFormatter();
  const left = balance.planCredits + balance.packCredits;
  const ratio = balance.planTotal > 0 ? Math.min(1, balance.planCredits / balance.planTotal) : left > 0 ? 1 : 0;
  const reset = balance.periodEnd ? format.dateTime(new Date(balance.periodEnd), { dateStyle: "medium" }) : null;
  const title = reset ? t("resetsOn", { date: reset }) : t("noReset");
  const low = balance.planTotal > 0 && left <= balance.planTotal * 0.2;
  const r = 8;
  const c = 2 * Math.PI * r;

  return (
    <Link
      href="/account?tab=plan"
      prefetch={false}
      title={title}
      data-testid="credits"
      className={`inline-flex items-center gap-2 rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand ${
        variant === "ring" ? "h-8 border bg-surface px-2.5 text-xs" : "text-[13px]"
      }`}
    >
      <svg viewBox="0 0 20 20" className="size-4.5 -rotate-90" aria-hidden="true">
        <circle cx="10" cy="10" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="2.5" />
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke={low ? "var(--caution)" : "var(--brand)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${c * ratio} ${c}`}
        />
      </svg>
      <span className="tabular-nums">{t("creditsLeft", { count: left })}</span>
      <span className="sr-only">{title}</span>
    </Link>
  );
}
