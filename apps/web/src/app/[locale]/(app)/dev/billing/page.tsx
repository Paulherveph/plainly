import { notFound } from "next/navigation";
import { BillingSimulator } from "@/modules/billing/ui/billing-simulator";
import { billingProvider, simulatorEnabled } from "@/server/billing";

export const metadata = { title: "Billing simulator", robots: { index: false } };

/** Dev-only stand-in for a provider checkout and portal (BILLING_PROVIDER=fake). 404 in production. */
export default async function DevBillingPage({ searchParams }: PageProps<"/[locale]/dev/billing">) {
  if (!simulatorEnabled()) notFound();
  const token = (await searchParams).session;
  const provider = billingProvider();
  const session =
    typeof token === "string" && provider.readSession ? await provider.readSession(token) : null;
  if (!session || typeof token !== "string") notFound();
  return (
    <section className="mx-auto max-w-lg px-5 pt-14 pb-24">
      <BillingSimulator token={token} kind={session.kind} productId={session.productId} />
    </section>
  );
}
