import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PUBLIC_PLANS } from "@/modules/billing/domain/public-plans";
import { alternatesFor } from "@/shared/i18n/alternates";
import {
  Faq,
  FinalCta,
  Hero,
  HowItWorks,
  InstallSection,
  PricingTeaser,
  PrivacyBand,
  SocialProof,
} from "@/shared/ui/landing";
import { UseCases } from "@/shared/ui/use-cases";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const meta = await getTranslations({ locale, namespace: "meta" });
  const image = { url: "/og/og-plainly.jpg", width: 1024, height: 1024, alt: meta("imageAlt") };
  const ogLocales = { en: "en_US", fr: "fr_FR", zh: "zh_CN" } as Record<string, string>;
  return {
    title: { absolute: meta("title") },
    description: meta("description"),
    alternates: alternatesFor(locale, ""),
    // Segments replace openGraph whole, so the home page repeats the layout's block and adds og:url.
    openGraph: {
      type: "website",
      siteName: meta("siteName"),
      title: meta("title"),
      description: meta("description"),
      url: `/${locale}`,
      locale: ogLocales[locale],
      alternateLocale: Object.values(ogLocales).filter((l) => l !== ogLocales[locale]),
      images: [image],
    },
    twitter: { card: "summary_large_image", title: meta("title"), description: meta("description"), images: [image] },
  };
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <UseCases />
      <PrivacyBand />
      <InstallSection />
      <SocialProof />
      <PricingTeaser
        freeCredits={PUBLIC_PLANS.free.credits}
        proMonthCents={PUBLIC_PLANS.pro.priceMonthCents}
      />
      <Faq />
      <FinalCta />
    </>
  );
}
