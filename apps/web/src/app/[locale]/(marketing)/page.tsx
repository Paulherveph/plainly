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
      <PricingTeaser guestLimit={PUBLIC_PLANS.guest.credits} memberLimit={PUBLIC_PLANS.free.credits} />
      <Faq />
      <FinalCta />
    </>
  );
}
