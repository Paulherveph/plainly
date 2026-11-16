import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BillingSimulator } from "@/modules/billing/ui/billing-simulator";
import { billingProvider, simulatorEnabled } from "@/server/billing";

export const metadata = { title: "Billing simulator", robots: { index: false } };

type SearchParams = PageProps<"/[locale]/dev/billing">["searchParams"];

/**
 * Dev-only stand-in for a provider checkout and portal (BILLING_PROVIDER=fake). Proxy answers a
 * disabled simulator or a forged session with a 404 before streaming; these checks are the backstop.
 */
export default function DevBillingPage({ searchParams }: PageProps<"/[locale]/dev/billing">) {
  if (!simulatorEnabled()) notFound();
  return (
    <section className="mx-auto max-w-lg px-5 pt-14 pb-24">
      <Suspense>
        <Simulator searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Simulator({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // the signed session carries an expiry, checked against the request time
  const token = (await searchParams).session;
  const provider = billingProvider();
  const session =
    typeof token === "string" && provider.readSession ? await provider.readSession(token) : null;
  if (!session || typeof token !== "string") notFound();
  return <BillingSimulator token={token} kind={session.kind} productId={session.productId} />;
}
