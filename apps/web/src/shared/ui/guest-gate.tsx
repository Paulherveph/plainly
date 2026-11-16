"use client";

import { ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { startGuestAction } from "@/server/actions/auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { Turnstile, turnstileSiteKey } from "./turnstile";

type Gate = { ensure: () => Promise<boolean> };
const GuestGateContext = createContext<Gate>({ ensure: async () => true });

/**
 * E01/E02: nothing is stored until the first action (upload, paste, sample). Then a guest is
 * created, after a Turnstile check when it is configured. Signed-in users pass straight through.
 */
export function GuestGateProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const ready = useRef(false);
  const [open, setOpen] = useState(false);
  const waiter = useRef<((token: string | null) => void) | null>(null);

  // Messages from the sign-in callback: ?merged=n (E06) or ?auth=failed. Shown once, then removed.
  useEffect(() => {
    const url = new URL(window.location.href);
    const merged = Number(url.searchParams.get("merged") ?? 0);
    const failed = url.searchParams.get("auth") === "failed";
    if (merged > 0) toast.success(t("merged", { count: merged }));
    if (failed) toast.error(t("failed"));
    if (merged > 0 || failed) {
      url.searchParams.delete("merged");
      url.searchParams.delete("auth");
      window.history.replaceState(null, "", url);
    }
  }, [t]);

  const ensure = useCallback(async () => {
    const askToken = () =>
      new Promise<string | null>((resolve) => {
        waiter.current = resolve;
        setOpen(true);
      });
    if (ready.current) return true;
    let res = await startGuestAction(null);
    if (!res.ok && res.error.kind === "needs_captcha") {
      const token = await askToken();
      setOpen(false);
      if (!token) return false;
      res = await startGuestAction(token);
    }
    if (!res.ok) {
      toast.error(res.error.kind === "rate_limited" ? t("rateLimited") : t("captchaFailed"));
      return false;
    }
    ready.current = true;
    router.refresh();
    return true;
  }, [router, t]);

  return (
    <GuestGateContext.Provider value={{ ensure }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) waiter.current?.(null);
          setOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="mb-2 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-text">
              <ShieldCheckIcon className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle>{t("checkTitle")}</DialogTitle>
            <DialogDescription>{t("checkBody")}</DialogDescription>
          </DialogHeader>
          <Turnstile
            siteKey={turnstileSiteKey()}
            action="guest"
            onToken={(token) => waiter.current?.(token)}
            onError={() => waiter.current?.(null)}
          />
        </DialogContent>
      </Dialog>
    </GuestGateContext.Provider>
  );
}

export const useGuestGate = () => useContext(GuestGateContext);
