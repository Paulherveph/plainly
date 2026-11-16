"use client";

import { CalendarClockIcon, PackageIcon, SparklesIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { checkoutAction, getCreditsAction } from "@/server/actions/billing";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { SignInDialog } from "@/shared/ui/sign-in-dialog";
import type { CreditBalance } from "../application/ports";

export type PaywallReason =
  | { kind: "insufficient_credits"; needed?: number }
  | { kind: "feature_not_in_plan"; feature: "deep_chat" | "extra_locale" | "credit_packs" };

/**
 * Soft paywall (docs/PRICING.md section 5): what happened, what it costs, and three ways on
 * (wait for the reset, buy a pack, upgrade). Never a dead end; reading always stays open.
 */
export function PaywallDialog({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: PaywallReason;
}) {
  const t = useTranslations("Billing");
  const locale = useLocale();
  const format = useFormatter();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    void getCreditsAction().then((res) => setBalance(res.ok ? res.value : null));
  }, [open]);

  const guest = balance?.planId === "guest" || balance === null;
  const left = balance ? balance.planCredits + balance.packCredits : 0;
  const reset = balance?.periodEnd
    ? format.dateTime(new Date(balance.periodEnd), { dateStyle: "medium" })
    : null;
  const buy = (productId: string) =>
    start(async () => {
      await checkoutAction({ productId, locale, back: window.location.pathname });
    });

  if (signIn)
    return (
      <SignInDialog
        open
        onOpenChange={(o) => {
          if (o) return;
          setSignIn(false);
          onOpenChange(false);
        }}
      />
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="paywall">
        <DialogHeader>
          <div className="mb-2 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-text">
            <SparklesIcon className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="text-xl">
            {reason.kind === "feature_not_in_plan" ? t("featureTitle") : t("creditsTitle")}
          </DialogTitle>
          <DialogDescription>
            {reason.kind === "feature_not_in_plan"
              ? t(`feature_${reason.feature}`)
              : t("creditsBody", { needed: reason.needed ?? 1, left })}{" "}
            {t("readingStays")}
          </DialogDescription>
        </DialogHeader>
        {guest ? (
          <div className="grid gap-2.5">
            <p className="text-muted-foreground text-sm">{t("guestBody")}</p>
            <Button size="lg" onClick={() => setSignIn(true)}>
              {t("guestCta")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {reset && reason.kind === "insufficient_credits" ? (
              <p className="flex items-center gap-2 rounded-xl border bg-surface px-3.5 py-3 text-sm">
                <CalendarClockIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                {t("waitForReset", { date: reset })}
              </p>
            ) : null}
            {reason.kind === "insufficient_credits" ? (
              <Button variant="outline" size="lg" disabled={pending} onClick={() => buy("pack_200")}>
                <PackageIcon />
                {t("buyPack")}
              </Button>
            ) : null}
            <Button size="lg" disabled={pending} onClick={() => buy("pro_month")}>
              <SparklesIcon />
              {t("upgrade")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
