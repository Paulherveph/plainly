import type { Metadata } from "next";
import { DAILY_LIMITS } from "@/modules/quota/domain/quota";
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

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "") };
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <PrivacyBand />
      <InstallSection />
      <SocialProof />
      <PricingTeaser guestLimit={DAILY_LIMITS.analysis.guest} memberLimit={DAILY_LIMITS.analysis.member} />
      <Faq />
      <FinalCta />
    </>
  );
}
