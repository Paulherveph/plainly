"use client";

import { CheckIcon, MinusIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { checkoutAction } from "@/server/actions/billing";
import { Link } from "@/shared/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { PUBLIC_PLANS } from "../domain/public-plans";

type Row = { key: string; guest: string | boolean; free: string | boolean; pro: string | boolean };

/** Three cards, a monthly or yearly toggle, and a comparison table (docs/PRICING.md section 5). */
export function PricingPlans() {
  const t = useTranslations("Pricing");
  const locale = useLocale();
  const format = useFormatter();
  const [yearly, setYearly] = useState(false);
  const [pending, start] = useTransition();
  const money = (cents: number) => format.number(cents / 100, { style: "currency", currency: "USD" });
  const buy = (productId: string) => start(async () => void (await checkoutAction({ productId, locale })));

  const rows: Row[] = [
    { key: "credits", guest: t("creditsOnce", { count: PUBLIC_PLANS.guest.credits }), free: t("creditsMonth", { count: PUBLIC_PLANS.free.credits }), pro: t("creditsMonth", { count: PUBLIC_PLANS.pro.credits }) },
    { key: "pages", guest: String(PUBLIC_PLANS.guest.maxPages), free: String(PUBLIC_PLANS.free.maxPages), pro: String(PUBLIC_PLANS.pro.maxPages) },
    { key: "size", guest: "5 MB", free: "10 MB", pro: "20 MB" },
    { key: "retention", guest: t("days", { count: 7 }), free: t("days", { count: 30 }), pro: t("days", { count: 180 }) },
    { key: "deep", guest: false, free: false, pro: true },
    { key: "locales", guest: "1", free: "1", pro: t("all") },
    { key: "packs", guest: false, free: true, pro: true },
    { key: "support", guest: false, free: t("supportDocs"), pro: t("supportEmail") },
  ];

  return (
    <>
      <div className="mt-10 flex justify-center">
        <div role="radiogroup" aria-label={t("billingPeriod")} className="inline-flex rounded-full border bg-surface p-1">
          {[false, true].map((y) => (
            <button
              key={String(y)}
              type="button"
              role="radio"
              aria-checked={yearly === y}
              onClick={() => setYearly(y)}
              className="h-8 rounded-full px-4 font-medium text-muted-foreground text-sm aria-checked:bg-surface-2 aria-checked:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
            >
              {y ? t("yearly") : t("monthly")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card title={t("guestName")} price={money(0)} note={t("guestNote")}>
          <Button asChild variant="outline" className="w-full">
            <Link href="/documents" prefetch={false}>
              {t("guestCta")}
            </Link>
          </Button>
        </Card>
        <Card title={t("freeName")} price={money(0)} note={t("freeNote")}>
          <Button asChild variant="outline" className="w-full">
            <Link href="/sign-in" prefetch={false}>
              {t("freeCta")}
            </Link>
          </Button>
        </Card>
        <Card
          title={t("proName")}
          price={yearly ? money(PUBLIC_PLANS.pro.priceYearCents) : money(PUBLIC_PLANS.pro.priceMonthCents)}
          per={yearly ? t("perYear") : t("perMonth")}
          note={yearly ? t("yearlyNote") : t("proNote")}
          highlight
        >
          <Button className="w-full" disabled={pending} onClick={() => buy(yearly ? "pro_year" : "pro_month")}>
            {t("proCta")}
          </Button>
        </Card>
      </div>

      <p className="mt-6 text-center text-muted-foreground text-sm">
        {t("packLine", { credits: PUBLIC_PLANS.pack.credits, price: money(PUBLIC_PLANS.pack.priceCents) })}{" "}
        <button
          type="button"
          onClick={() => buy("pack_200")}
          disabled={pending}
          className="font-medium text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand"
        >
          {t("packCta")}
        </button>
      </p>

      <div className="mt-14 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">{t("compareTitle")}</caption>
          <thead className="bg-surface text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("compareFeature")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("guestName")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("freeName")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("proName")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t">
                <th scope="row" className="px-4 py-3 font-normal">
                  {t(`row_${r.key}`)}
                </th>
                {[r.guest, r.free, r.pro].map((v, i) => (
                  <td key={i} className="px-4 py-3 tabular-nums">
                    {typeof v === "boolean" ? (
                      v ? (
                        <CheckIcon className="size-4 text-ok" aria-label={t("yes")} />
                      ) : (
                        <MinusIcon className="size-4 text-faint" aria-label={t("no")} />
                      )
                    ) : (
                      v
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Card(props: {
  title: string;
  price: string;
  per?: string;
  note: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col rounded-2xl border p-6 ${props.highlight ? "border-brand/50 bg-brand-soft/40" : "bg-surface"}`}
    >
      <h2 className="font-semibold text-lg">{props.title}</h2>
      <p className="mt-3">
        <span className="font-semibold text-4xl tabular-nums">{props.price}</span>
        {props.per ? <span className="ml-1 text-muted-foreground text-sm">{props.per}</span> : null}
      </p>
      <p className="mt-2 flex-1 text-muted-foreground text-sm">{props.note}</p>
      <div className="mt-6">{props.children}</div>
    </section>
  );
}
