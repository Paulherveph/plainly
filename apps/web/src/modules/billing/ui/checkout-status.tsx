"use client";

import { CheckCircle2Icon, DownloadIcon, Loader2Icon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { safeNext } from "@/shared/lib/safe-next";
import { Button } from "@/shared/ui/button";
import type { Receipt } from "../domain/receipt";

type Status = { planId: string; packCredits: number; receipt: Receipt | null };

/** Polls /api/billing/status until the webhook has landed (plan active or pack credits added). */
export function CheckoutStatus() {
  const t = useTranslations("Billing");
  const [state, setState] = useState<"confirming" | "done" | "slow">("confirming");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [next, setNext] = useState("/");

  useEffect(() => {
    setNext(
      safeNext(
        new URLSearchParams(window.location.search).get("next"),
        `${window.location.pathname.slice(0, 3)}/documents`,
      ),
    );
    let tries = 0;
    let stop = false;
    const tick = async () => {
      tries++;
      const res = await fetch("/api/billing/status", { cache: "no-store" }).catch(() => null);
      const s = res?.ok ? ((await res.json()) as Status) : null;
      if (stop) return;
      if (s && (!["free", "guest"].includes(s.planId) || s.packCredits > 0)) {
        setReceipt(s.receipt);
        return setState("done");
      }
      if (tries >= 15) return setState("slow");
      setTimeout(tick, 2_000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, []);

  if (state === "done" && receipt) return <Confirmed receipt={receipt} next={next} />;
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 text-center" aria-live="polite">
      {state === "done" ? (
        <CheckCircle2Icon className="size-10 text-ok" aria-hidden="true" />
      ) : (
        <Loader2Icon
          className="size-10 animate-spin text-muted-foreground motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      <h1 className="font-semibold text-2xl tracking-tight">
        {state === "done" ? t("successTitle") : t("confirmingTitle")}
      </h1>
      <p className="text-muted-foreground">
        {state === "done" ? t("successBody") : state === "slow" ? t("slowBody") : t("confirmingBody")}
      </p>
      <Button asChild>
        <a href={next}>{t("continue")}</a>
      </Button>
    </div>
  );
}

/** The confirmed purchase: a short message on the left, the payment summary on the right. */
function Confirmed({ receipt, next }: { receipt: Receipt; next: string }) {
  const t = useTranslations("Billing");
  const format = useFormatter();
  const locale = useLocale();
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "long", timeZone: "UTC" });
  const amount = format.number(receipt.amountCents / 100, {
    style: "currency",
    currency: receipt.currency.toUpperCase(),
  });
  const plan = t(`plan_${receipt.productId}`);
  const rows: [string, string][] = [
    [t("summaryPlan"), plan],
    [t("summaryBilling"), t(`billed_${receipt.interval}`)],
    [
      t("summaryCredits"),
      receipt.kind === "pack"
        ? t("creditsOnce", { count: receipt.credits })
        : t("creditsMonthly", { count: receipt.credits }),
    ],
  ];
  if (receipt.periodEnd) rows.push([t("summaryRenews"), date(receipt.periodEnd)]);
  rows.push([t("summaryPayment"), receipt.demo ? t("summaryDemo") : amount]);
  rows.push([t("summaryReceipt"), receipt.number]);

  return (
    <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-live="polite">
      <div className="grid justify-items-start gap-5">
        <span className="grid size-14 animate-icon-in place-items-center rounded-full bg-ok/15 text-ok motion-reduce:animate-none">
          <CheckCircle2Icon className="size-7" aria-hidden="true" />
        </span>
        <div className="grid gap-2">
          <h1 className="font-semibold text-3xl tracking-tight md:text-4xl">{t("successTitle")}</h1>
          <p className="max-w-sm text-muted-foreground">
            {receipt.kind === "pack"
              ? t("successPackBody", { count: receipt.credits })
              : t("successPlanBody", { plan, count: receipt.credits })}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-xl">
            <a href={next}>{t("goToDocuments")}</a>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-xl">
            <a href={`/api/billing/receipt?locale=${locale}`} download>
              <DownloadIcon className="size-4" aria-hidden="true" />
              {t("downloadReceipt")}
            </a>
          </Button>
        </div>
      </div>

      <section
        aria-labelledby="summary-title"
        className="animate-rise rounded-2xl border bg-surface p-6 motion-reduce:animate-none"
      >
        <h2 id="summary-title" className="font-semibold">
          {t("summaryTitle")}
        </h2>
        <dl className="mt-5 grid gap-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
          <div className="mt-2 flex justify-between gap-4 border-t pt-4 font-semibold text-base">
            <dt>{t("total")}</dt>
            <dd className="tabular-nums">{amount}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
