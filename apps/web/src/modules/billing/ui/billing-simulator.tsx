"use client";

import { useState, useTransition } from "react";
import { simulateBillingAction } from "@/server/actions/billing";
import { Button } from "@/shared/ui/button";

const CHECKOUT = [
  { event: "success", label: "Pay (success)" },
  { event: "payment_failed", label: "Payment fails (past due)" },
] as const;
const PORTAL = [
  { event: "renewal", label: "Renew period" },
  { event: "payment_failed", label: "Renewal payment fails" },
  { event: "cancel", label: "Cancel at period end" },
  { event: "cancel_now", label: "Cancel now" },
  { event: "refund", label: "Refund" },
] as const;

/** Developer tool, English only on purpose: it never ships to users (404 outside fake billing). */
export function BillingSimulator(props: {
  token: string;
  kind: "plan" | "pack" | "portal";
  productId: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const actions = props.kind === "portal" ? PORTAL : CHECKOUT;
  const send = (event: string) =>
    start(async () => {
      const res = await simulateBillingAction({ session: props.token, event });
      if (res.ok) window.location.assign(res.value.next);
      else setError(res.error.kind);
    });
  return (
    <div className="grid gap-4 rounded-2xl border border-dashed p-6">
      <p className="font-mono text-faint text-xs uppercase tracking-wide">Fake billing · dev only</p>
      <h1 className="font-semibold text-2xl">
        {props.kind === "portal" ? "Billing portal" : `Checkout: ${props.productId}`}
      </h1>
      <div className="grid gap-2">
        {actions.map((a) => (
          <Button key={a.event} variant="outline" disabled={pending} onClick={() => send(a.event)}>
            {a.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-critical text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
