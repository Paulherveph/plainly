"use client";

import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { safeNext } from "@/shared/lib/safe-next";
import { Button } from "@/shared/ui/button";

type Status = { planId: string; packCredits: number };

/** Polls /api/billing/status until the webhook has landed (plan active or pack credits added). */
export function CheckoutStatus() {
  const t = useTranslations("Billing");
  const [state, setState] = useState<"confirming" | "done" | "slow">("confirming");
  const [next, setNext] = useState("/");

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get("next"), `${window.location.pathname.slice(0, 3)}/documents`));
    let tries = 0;
    let stop = false;
    const tick = async () => {
      tries++;
      const res = await fetch("/api/billing/status", { cache: "no-store" }).catch(() => null);
      const s = res?.ok ? ((await res.json()) as Status) : null;
      if (stop) return;
      if (s && (!["free", "guest"].includes(s.planId) || s.packCredits > 0)) return setState("done");
      if (tries >= 15) return setState("slow");
      setTimeout(tick, 2_000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, []);

  return (
    <div className="grid justify-items-center gap-4 text-center" aria-live="polite">
      {state === "done" ? (
        <CheckCircle2Icon className="size-10 text-ok" aria-hidden="true" />
      ) : (
        <Loader2Icon className="size-10 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
      )}
      <h1 className="font-semibold text-2xl tracking-tight">
        {state === "done" ? t("successTitle") : t("confirmingTitle")}
      </h1>
      <p className="text-muted-foreground">
        {state === "done" ? t("successBody") : state === "slow" ? t("slowBody") : t("confirmingBody")}
      </p>
      <Button asChild>
        <a href={next}>{t("continue")}</a>
      </Button>
    </div>
  );
}
