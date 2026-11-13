import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PricingPlans } from "@/modules/billing/ui/pricing-plans";
import { alternatesFor } from "@/shared/i18n/alternates";

export async function generateMetadata({ params }: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pricing" });
  return { title: t("title"), description: t("lead"), alternates: alternatesFor(locale, "/pricing") };
}

const FAQ = ["credits", "refunds", "data", "cancel", "reading"] as const;

/** Static: plan facts come from PUBLIC_PLANS (they mirror the plans table, checked by a test). */
export default async function PricingPage({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pricing" });
  return (
    <article className="mx-auto max-w-marketing px-5 pt-12 pb-24 md:px-8 md:pt-16">
      <header className="mx-auto max-w-[720px] text-center">
        <h1 className="font-semibold text-4xl leading-[1.1] tracking-tight md:text-[44px]">{t("title")}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{t("lead")}</p>
      </header>

      <PricingPlans />

      <section aria-labelledby="faq-title" className="mx-auto mt-20 max-w-[720px]">
        <h2 id="faq-title" className="font-semibold text-2xl tracking-tight">
          {t("faqTitle")}
        </h2>
        <dl className="mt-6 grid gap-5">
          {FAQ.map((k) => (
            <div key={k} className="rounded-2xl border bg-surface p-5">
              <dt className="font-medium">{t(`faq_${k}_q`)}</dt>
              <dd className="mt-1.5 text-muted-foreground text-sm">{t(`faq_${k}_a`)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
