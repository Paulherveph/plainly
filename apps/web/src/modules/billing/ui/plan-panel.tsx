"use client";

import { CreditCardIcon, SparklesIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { portalAction } from "@/server/actions/billing";
import { Link } from "@/shared/i18n/navigation";
import { Button } from "@/shared/ui/button";
import type { CreditBalance, LedgerEntry } from "../application/ports";

/** Account → Plan and usage: plan, credits, next reset, a 14-day usage chart and the ledger. */
export function PlanPanel({ balance, ledger }: { balance: CreditBalance; ledger: LedgerEntry[] }) {
  const t = useTranslations("Billing");
  const format = useFormatter();
  const locale = useLocale();
  const [pending, start] = useTransition();
  const paid = balance.planId !== "free" && balance.planId !== "guest";
  const days = usageByDay(ledger, 14);
  const max = Math.max(1, ...days.map((d) => d.used));

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 rounded-2xl border bg-surface p-5 sm:grid-cols-3">
        <Stat label={t("plan")} value={t(`plan_${balance.planId}`)} />
        <Stat label={t("creditsLabel")} value={String(balance.planCredits + balance.packCredits)} />
        <Stat
          label={t("resetLabel")}
          value={
            balance.periodEnd ? format.dateTime(new Date(balance.periodEnd), { dateStyle: "medium" }) : "—"
          }
        />
        {!balance.emailVerified && balance.planId === "free" ? (
          <p className="text-caution text-sm sm:col-span-3">{t("verifyEmail")}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          {paid ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => start(async () => void (await portalAction({ locale })))}
            >
              <CreditCardIcon />
              {t("manageBilling")}
            </Button>
          ) : (
            <Button asChild>
              <Link href="/pricing">
                <SparklesIcon />
                {t("upgrade")}
              </Link>
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="font-semibold">{t("usageTitle")}</h2>
        <div className="mt-4 flex h-28 items-end gap-1.5" role="img" aria-label={t("usageAria")}>
          {days.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-brand/70"
                style={{ height: `${Math.round((d.used / max) * 100)}%`, minHeight: d.used ? 3 : 1 }}
                title={`${d.day}: ${d.used}`}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="font-semibold">{t("ledgerTitle")}</h2>
        {ledger.length === 0 ? (
          <p className="mt-2 text-muted-foreground text-sm">{t("ledgerEmpty")}</p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {ledger.slice(0, 30).map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="text-muted-foreground">
                  {t(`reason_${e.reason}`)} ·{" "}
                  {format.dateTime(new Date(e.createdAt), { dateStyle: "short", timeStyle: "short" })}
                </span>
                <span className={`font-mono tabular-nums ${e.delta < 0 ? "" : "text-ok"}`}>
                  {e.delta > 0 ? `+${e.delta}` : e.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-semibold text-xl tabular-nums">{value}</p>
    </div>
  );
}

/** Credits spent per UTC day (holds minus refunds and releases). */
function usageByDay(ledger: LedgerEntry[], n: number): { day: string; used: number }[] {
  const out = new Map<string, number>();
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    out.set(d, 0);
  }
  for (const e of ledger) {
    const day = e.createdAt.slice(0, 10);
    if (!out.has(day)) continue;
    if (e.reason === "hold") out.set(day, (out.get(day) ?? 0) - e.delta);
    if (e.reason === "release" || e.reason === "settle_refund") out.set(day, (out.get(day) ?? 0) - e.delta);
  }
  return [...out.entries()].map(([day, used]) => ({ day, used: Math.max(0, used) }));
}
