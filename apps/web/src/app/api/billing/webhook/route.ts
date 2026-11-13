import { makeHandleWebhook } from "@/modules/billing/application/billing";
import { billingProvider, billingStore } from "@/server/billing";

/**
 * Provider webhooks. Signature checked, event stored by provider id (unique), processed once,
 * answered fast. The browser return URL never grants anything.
 */
export async function POST(request: Request) {
  const store = billingStore();
  if (!store) return new Response("Billing is not configured", { status: 503 });
  const handle = makeHandleWebhook({ provider: billingProvider(), store });
  const res = await handle(request);
  if (res.ok) return Response.json({ received: true, result: res.value });
  const status = res.error.kind === "bad_signature" ? 401 : res.error.kind === "bad_event" ? 400 : 500;
  return Response.json({ error: res.error.kind }, { status });
}
