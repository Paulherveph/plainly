import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckoutStatus } from "@/modules/billing/ui/checkout-status";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/billing/success">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Billing" });
  return { title: t("successTitle"), robots: { index: false } };
}

/** F08: calm confirmation that waits for the webhook, never trusts this return URL. */
export default function SuccessPage() {
  return (
    <section className="mx-auto max-w-md px-5 pt-16 pb-24">
      <CheckoutStatus />
    </section>
  );
}
