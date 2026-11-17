import { container } from "@/server/container";

/** F08: the success page polls this until the webhook has landed. No document content, billing facts only. */
export async function GET() {
  const c = await container();
  if (!(await c.currentUser())) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const balance = await c.entitlements.balance();
  if (!balance.ok) return Response.json({ error: balance.error.kind }, { status: 500 });
  const { planId, planCredits, packCredits } = balance.value;
  // The summary on the success page: product, price and period from our records, never from the URL.
  const receipt = await c.latestReceipt();
  return Response.json(
    { planId, planCredits, packCredits, receipt: receipt.ok ? receipt.value : null },
    { headers: { "cache-control": "no-store" } },
  );
}
