import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BillingSimulator } from "@/modules/billing/ui/billing-simulator";
import { DemoCheckout } from "@/modules/billing/ui/demo-checkout";
import { billingProvider, simulatorEnabled } from "@/server/billing";
import { container } from "@/server/container";
import { Skeleton } from "@/shared/ui/skeleton";

export async function generateMetadata({ params }: PageProps<"/[locale]/checkout">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Billing" });
  return { title: t("checkoutTitle"), robots: { index: false } };
}

type SearchParams = PageProps<"/[locale]/checkout">["searchParams"];

/**
 * The fake provider's checkout and portal (BILLING_PROVIDER=fake, ALLOW_FAKE_BILLING). Proxy answers a
 * disabled checkout or a forged session with a 404 before streaming; these checks are the backstop.
 */
export default function CheckoutPage({ searchParams }: PageProps<"/[locale]/checkout">) {
  if (!simulatorEnabled()) notFound();
  return (
    <section className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-12">
      <Suspense
        fallback={
          <div className="grid gap-8 md:grid-cols-2">
            <Skeleton className="aspect-[1.586] w-full max-w-[380px] justify-self-center rounded-2xl" />
            <Skeleton className="h-[480px] w-full rounded-2xl" />
          </div>
        }
      >
        <Checkout searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Checkout({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // the signed session carries an expiry, checked against the request time
  const token = (await searchParams).session;
  const provider = billingProvider();
  const session =
    typeof token === "string" && provider.readSession ? await provider.readSession(token) : null;
  if (!session || typeof token !== "string") notFound();
  if (session.kind === "portal") return <BillingSimulator token={token} kind="portal" productId="" />;

  const plans = await (await container()).plans();
  const plan = plans.ok ? plans.value.find((p) => p.id === session.productId) : undefined;
  if (!plan) notFound();
  return (
    <DemoCheckout
      token={token}
      product={{
        id: plan.id,
        interval: plan.interval === "month" || plan.interval === "year" ? plan.interval : "once",
        priceCents: plan.priceCents,
        currency: plan.currency,
        credits: plan.entitlements.credits,
      }}
    />
  );
}
