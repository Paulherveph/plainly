import { container } from "@/server/container";

/** F08: the success page polls this until the webhook has landed. No content, plan facts only. */
export async function GET() {
  const c = await container();
  if (!(await c.currentUser())) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const balance = await c.entitlements.balance();
  if (!balance.ok) return Response.json({ error: balance.error.kind }, { status: 500 });
  const { planId, planCredits, packCredits } = balance.value;
  return Response.json({ planId, planCredits, packCredits }, { headers: { "cache-control": "no-store" } });
}
