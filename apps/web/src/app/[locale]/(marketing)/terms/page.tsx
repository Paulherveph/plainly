import { ScaleIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { publicEnv } from "@/shared/config/env";
import { alternatesFor } from "@/shared/i18n/alternates";
import { LEGAL_VERSIONS } from "@/shared/lib/legal";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Terms" });
  return { title: t("title"), description: t("lead"), alternates: alternatesFor(locale, "/terms") };
}

const SECTIONS = ["service", "account", "credits", "refunds", "use", "advice", "ai", "content", "liability", "ending", "changes", "contact"] as const;

/** Terms of Service (en, fr, zh). Acceptance is recorded per version at sign-up (G08). */
export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Terms" });
  const operator = publicEnv().NEXT_PUBLIC_OPERATOR;
  return (
    <article className="mx-auto max-w-[1120px] px-5 pt-12 pb-24 md:px-8 md:pt-16">
      <div className="max-w-[720px]">
        <span className="eyebrow">
          <ScaleIcon className="size-3.5" aria-hidden="true" />
          {t("eyebrow", { version: LEGAL_VERSIONS.terms })}
        </span>
        <h1 className="mt-5 font-semibold text-4xl leading-[1.1] tracking-tight md:text-[44px]">{t("title")}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{t("lead")}</p>
        {operator ? <p className="mt-3 text-muted-foreground text-sm">{t("operator", { operator })}</p> : null}
        {SECTIONS.map((key) => (
          <section key={key} className="mt-10">
            <h2 className="font-semibold text-xl">{t(`${key}Title`)}</h2>
            <p className="mt-3 text-muted-foreground">{t(key)}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
