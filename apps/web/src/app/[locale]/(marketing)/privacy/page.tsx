import { ShieldIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { providerList } from "@/modules/ai/domain/pricing";
import { serverEnv } from "@/shared/config/env";
import { alternatesFor } from "@/shared/i18n/alternates";
import { DeleteEverything } from "@/shared/ui/delete-everything";
import { LoopVideo } from "@/shared/ui/loop-video";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });
  return { title: t("title"), description: t("lead"), alternates: alternatesFor(locale, "/privacy") };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });
  return (
    <article className="mx-auto max-w-[1120px] px-5 pt-12 pb-24 md:px-8 md:pt-16">
      <div className="max-w-[720px]">
        <span className="eyebrow">
          <ShieldIcon className="size-3.5" aria-hidden="true" />
          {t("eyebrow")}
        </span>
        <h1 className="mt-5 font-semibold text-4xl leading-[1.1] tracking-tight md:text-[44px]">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{t("lead")}</p>

        <Section title={t("storeTitle")}>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>{t("store1")}</li>
            <li>{t("store2")}</li>
            <li>{t("store3")}</li>
          </ul>
        </Section>
        <Section title={t("howLongTitle")}>
          <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-center">
            <p className="text-muted-foreground">{t("howLong")}</p>
            <LoopVideo
              name="loop-expiry"
              themed
              cycles={2}
              className="w-40 shrink-0 overflow-hidden rounded-xl border"
            />
          </div>
        </Section>
        <Section title={t("whoTitle")}>
          <p className="mt-3 text-muted-foreground">
            {t("who", { providers: providerList(serverEnv().AI_PROVIDERS_ALLOWED) })}
          </p>
        </Section>
        <Section title={t("processorsTitle")}>
          <p className="mt-3 text-muted-foreground">{t("processorsLead")}</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>{t("processorSupabase")}</li>
            <li>{t("processorVercel")}</li>
            <li>{t("processorAi", { providers: providerList(serverEnv().AI_PROVIDERS_ALLOWED) })}</li>
            <li>{t("processorCloudflare")}</li>
            <li>{t("processorResend")}</li>
            {serverEnv().SENTRY_DSN ? <li>{t("processorSentry")}</li> : null}
            <li>{t("processorBilling")}</li>
          </ul>
        </Section>
        <Section title={t("rightsTitle")}>
          <p className="mt-3 text-muted-foreground">{t("rights")}</p>
        </Section>
        <Section title={t("legalTitle")}>
          <p className="mt-3 text-muted-foreground">{t("legal")}</p>
        </Section>

        <div className="mt-12 flex flex-col gap-4 rounded-xl border border-critical/35 bg-[linear-gradient(180deg,var(--critical-soft),transparent)] p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">{t("deleteTitle")}</h2>
            <p className="mt-1 text-muted-foreground text-sm">{t("deleteBody")}</p>
          </div>
          <DeleteEverything />
        </div>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-semibold text-xl">{title}</h2>
      {children}
    </section>
  );
}
