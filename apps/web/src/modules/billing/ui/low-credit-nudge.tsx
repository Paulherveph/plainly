"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";
import { getCreditsAction, markLowNudgedAction } from "@/server/actions/billing";

/** At 20% left, one calm note per period, with a link to the plans. */
export function LowCreditNudge() {
  const t = useTranslations("Billing");
  useEffect(() => {
    let cancelled = false;
    void getCreditsAction().then(async (res) => {
      if (cancelled || !res.ok || !res.value.nudge) return;
      await markLowNudgedAction();
      const left = res.value.planCredits + res.value.packCredits;
      toast(t("lowTitle", { count: left }), {
        description: t("lowBody"),
        action: {
          label: t("seePlans"),
          onClick: () => window.location.assign(`${window.location.pathname.slice(0, 3)}/pricing`),
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [t]);
  return null;
}
