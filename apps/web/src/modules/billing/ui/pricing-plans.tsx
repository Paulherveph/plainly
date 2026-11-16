"use client";

import { CheckIcon, MinusIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { checkoutAction } from "@/server/actions/billing";
import { Link } from "@/shared/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { PUBLIC_PLANS, yearlySavingPercent } from "../domain/public-plans";

type Cell = string | boolean;
type Row = { key: string; free: Cell; pro: Cell; max: Cell };

const { free, pro, max, pack } = PUBLIC_PLANS;

/** Free, Pro and Max cards, a monthly or yearly switch, and a comparison table (docs/PRICING.md section 5). */
export function PricingPlans() {
  const t = useTranslations("Pricing");
  const locale = useLocale();
  const format = useFormatter();
  const [yearly, setYearly] = useState(false);
  const [pending, start] = useTransition();
  const money = (cents: number) =>
    format.number(cents / 100, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    });
  const buy = (productId: string) => start(async () => void (await checkoutAction({ productId, locale })));
  const paid = (plan: typeof pro | typeof max) => ({
    price: money(yearly ? plan.priceYearCents / 12 : plan.priceMonthCents),
    billed: yearly ? t("billedYearly", { price: money(plan.priceYearCents) }) : t("billedMonthly"),
  });

  const rows: Row[] = [
    {
      key: "credits",
      free: t("creditsMonth", { count: free.credits }),
      pro: t("creditsMonth", { count: pro.credits }),
      max: t("creditsMonth", { count: max.credits }),
    },
    { key: "pages", free: String(free.maxPages), pro: String(pro.maxPages), max: String(max.maxPages) },
    { key: "size", free: `${free.maxMb} MB`, pro: `${pro.maxMb} MB`, max: `${max.maxMb} MB` },
    {
      key: "retention",
      free: t("days", { count: free.retentionDays }),
      pro: t("days", { count: pro.retentionDays }),
      max: t("days", { count: max.retentionDays }),
    },
    { key: "deep", free: false, pro: true, max: true },
    { key: "locales", free: "1", pro: t("all"), max: t("all") },
    {
      key: "concurrency",
      free: String(free.concurrency),
      pro: String(pro.concurrency),
      max: String(max.concurrency),
    },
    { key: "packs", free: true, pro: true, max: true },
    { key: "support", free: t("supportDocs"), pro: t("supportEmail"), max: t("supportPriority") },
  ];

  return (
    <>
      <div className="mt-10 flex justify-center">
        <fieldset
          aria-label={t("billingPeriod")}
          className="m-0 inline-flex min-w-0 rounded-full border bg-surface p-1"
        >
          {[false, true].map((y) => (
            <button
              key={String(y)}
              type="button"
              aria-pressed={yearly === y}
              onClick={() => setYearly(y)}
              className="h-8 rounded-full px-4 font-medium text-muted-foreground text-sm transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand aria-pressed:bg-surface-2 aria-pressed:text-foreground"
            >
              {y ? t("yearly") : t("monthly")}
              {y ? (
                <span className="ml-1.5 text-brand-text">
                  · {t("save", { percent: yearlySavingPercent(pro) })}
                </span>
              ) : null}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="mx-auto mt-8 grid max-w-[520px] gap-4 lg:max-w-none lg:grid-cols-3">
        <PlanCard
          glyph={<PlanGlyph level={1} />}
          name={t("freeName")}
          tag={t("freeTag")}
          price={money(0)}
          unit={t("freeForever")}
          includes={t("freeIncludes")}
          features={[
            t("free_1", { credits: free.credits }),
            t("free_2", { pages: free.maxPages }),
            t("free_3"),
            t("free_4"),
            t("free_5", { days: free.retentionDays }),
            t("free_6"),
          ]}
        >
          <Button asChild variant="secondary" size="lg" className="w-full rounded-xl">
            <Link href="/documents" prefetch={false}>
              {t("freeCta")}
            </Link>
          </Button>
        </PlanCard>

        <PlanCard
          highlight
          glyph={<PlanGlyph level={2} />}
          name={t("proName")}
          tag={t("proTag")}
          {...paid(pro)}
          unit={`${t("currency")} ${t("perMonth")}`}
          caption={t("noCommit")}
          includes={t("proIncludes")}
          features={[
            t("pro_1", { credits: pro.credits }),
            t("pro_2", { pages: pro.maxPages, mb: pro.maxMb }),
            t("pro_3"),
            t("pro_4"),
            t("pro_5", { days: pro.retentionDays }),
            t("pro_6"),
          ]}
        >
          <Button
            size="lg"
            className="w-full rounded-xl"
            disabled={pending}
            onClick={() => buy(yearly ? "pro_year" : "pro_month")}
          >
            {t("proCta")}
          </Button>
        </PlanCard>

        <PlanCard
          glyph={<PlanGlyph level={3} />}
          name={t("maxName")}
          tag={t("maxTag")}
          {...paid(max)}
          unit={`${t("currency")} ${t("perMonth")}`}
          caption={t("noCommit")}
          includes={t("maxIncludes")}
          features={[
            t("max_1", { credits: max.credits }),
            t("max_2", { pages: max.maxPages, mb: max.maxMb }),
            t("max_3", { count: max.concurrency }),
            t("max_4"),
            t("max_5"),
          ]}
        >
          <Button
            size="lg"
            className="w-full rounded-xl"
            disabled={pending}
            onClick={() => buy(yearly ? "max_year" : "max_month")}
          >
            {t("maxCta")}
          </Button>
        </PlanCard>
      </div>

      <div className="mx-auto mt-8 max-w-[760px] space-y-1 text-center text-[13px] text-muted-foreground">
        <p>*{t("note1")}</p>
        <p>{t("note2")}</p>
        <p>{t("note3")}</p>
      </div>

      <p className="mt-6 text-center text-muted-foreground text-sm">
        {t("packLine", { credits: pack.credits, price: money(pack.priceCents) })}{" "}
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
              {[t("freeName"), t("proName"), t("maxName")].map((name) => (
                <th key={name} scope="col" className="px-4 py-3 font-medium">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t">
                <th scope="row" className="px-4 py-3 font-normal">
                  {t(`row_${r.key}`)}
                </th>
                {(["free", "pro", "max"] as const)
                  .map((col) => [col, r[col]] as const)
                  .map(([col, v]) => (
                    <td key={col} className="px-4 py-3 tabular-nums">
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

function PlanCard(props: {
  glyph: React.ReactNode;
  name: string;
  tag: string;
  price: string;
  unit: string;
  billed?: string;
  caption?: string;
  includes: string;
  features: string[];
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`relative flex flex-col overflow-hidden rounded-2xl border bg-surface ${
        props.highlight
          ? "border-brand/35 shadow-[0_0_0_1px_rgb(148_120_255/0.08),0_30px_80px_-40px_var(--brand-glow)]"
          : ""
      }`}
    >
      {props.highlight ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--brand),transparent)]"
        />
      ) : null}
      <div className="px-6 pt-7 pb-6 md:px-7">
        <div className="text-muted-foreground">{props.glyph}</div>
        <h2 className="mt-6 font-semibold text-[22px] tracking-tight">{props.name}</h2>
        <p className="mt-0.5 text-muted-foreground text-sm">{props.tag}</p>
        <div className="mt-6 flex min-h-14 items-end gap-2.5">
          <span className="font-semibold text-[40px] leading-none tracking-tight tabular-nums">
            {props.price}
          </span>
          <span className="pb-0.5 text-[12px] text-muted-foreground leading-tight">
            {props.unit}
            {props.billed ? (
              <>
                <br />
                {props.billed}
              </>
            ) : null}
          </span>
        </div>
        <div className="mt-6">{props.children}</div>
        <p className="mt-2.5 h-4 text-center text-[12px] text-muted-foreground">{props.caption ?? ""}</p>
      </div>
      <div className="flex-1 border-t px-6 py-6 md:px-7">
        <p className="text-muted-foreground text-sm">{props.includes}</p>
        <ul className="mt-3.5 grid gap-2.5 text-[14.5px]">
          {props.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Line glyph that grows with the plan: one page, a small stack, a full stack with a spark. */
function PlanGlyph({ level }: { level: 1 | 2 | 3 }) {
  return (
    <svg
      viewBox="0 0 56 56"
      aria-hidden="true"
      className="size-12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {level === 3 ? <rect x="20" y="6" width="26" height="34" rx="4" opacity="0.35" /> : null}
      {level >= 2 ? <rect x="15" y="11" width="26" height="34" rx="4" opacity="0.6" /> : null}
      <rect x="10" y="16" width="26" height="34" rx="4" className="fill-surface" />
      <path d="M16 26h14M16 32h10M16 38h6" />
      <circle cx="30" cy="40" r="2.2" className="fill-brand stroke-brand" />
      {level === 3 ? <path d="M47 4v6M44 7h6" className="stroke-brand" strokeWidth="1.6" /> : null}
    </svg>
  );
}
