"use client";

import { KeyRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { type AuthMode, SignInForm } from "./sign-in-form";

/**
 * Toasts render outside the dialog, so a click on one (the demo code's Copy button) would count as a click
 * outside and close the dialog mid sign-up. Keep it open for those; any other outside click still closes it.
 */
function keepOpenForToasts(event: Event): void {
  if (event.target instanceof Element && event.target.closest("[data-sonner-toaster]"))
    event.preventDefault();
}

/** Modal version of /sign-in, opened by "Save your work" and by paywalls. Opens on "create account". */
export function SignInDialog({
  trigger,
  open,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("Auth");
  const [inner, setInner] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signup");
  const isOpen = open ?? inner;
  const setOpen = onOpenChange ?? setInner;
  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md" onInteractOutside={keepOpenForToasts}>
        <DialogHeader>
          <div className="mb-2 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-text">
            <KeyRoundIcon className="size-5" />
          </div>
          <DialogTitle className="text-xl">{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <SignInForm mode={mode} onModeChange={setMode} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
