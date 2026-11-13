"use client";

import { LogOutIcon, MonitorSmartphoneIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { continueWithGoogle, signOutAction } from "@/server/actions/auth";
import { Button } from "@/shared/ui/button";
import { GoogleMark } from "@/shared/ui/sign-in-form";

/** Connected sign-in methods, sign out here, sign out of other devices. */
export function SecurityPanel({ identities, email }: { identities: string[]; email: string | null }) {
  const t = useTranslations("Account");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const hasGoogle = identities.includes("google");

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="font-semibold">{t("methodsTitle")}</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {email ? <li className="text-muted-foreground">{t("methodEmail", { email })}</li> : null}
          {hasGoogle ? <li className="text-muted-foreground">{t("methodGoogle")}</li> : null}
        </ul>
        {!hasGoogle ? (
          <Button
            variant="outline"
            className="mt-4"
            disabled={pending}
            onClick={() => start(async () => void (await continueWithGoogle(locale, `/${locale}/account`)))}
          >
            <GoogleMark />
            {t("linkGoogle")}
          </Button>
        ) : null}
      </section>
      <section className="flex flex-wrap gap-3 rounded-2xl border bg-surface p-5">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await signOutAction("others");
              toast[res.ok ? "success" : "error"](res.ok ? t("othersSignedOut") : t("failed"));
            })
          }
        >
          <MonitorSmartphoneIcon />
          {t("signOutOthers")}
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await signOutAction("local");
              if (res.ok) window.location.assign(`/${locale}`);
              else toast.error(t("failed"));
            })
          }
        >
          <LogOutIcon />
          {t("signOut")}
        </Button>
      </section>
    </div>
  );
}
