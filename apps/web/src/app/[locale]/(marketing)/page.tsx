import type { Metadata } from "next";
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
  return { alternates: alternatesFor(locale, "") };
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
