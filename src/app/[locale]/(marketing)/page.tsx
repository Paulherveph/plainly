import type { Metadata } from "next";
import { alternatesFor } from "@/shared/i18n/alternates";
import { Faq, Features, FinalCta, Hero, HowItWorks, PrivacyBand } from "@/shared/ui/landing";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "") };
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <PrivacyBand />
      <Faq />
      <FinalCta />
    </>
  );
}
