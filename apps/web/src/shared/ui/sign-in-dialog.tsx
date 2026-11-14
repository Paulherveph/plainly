"use client";

import { KeyRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { type AuthMode, SignInForm } from "./sign-in-form";

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
      <DialogContent className="sm:max-w-md">
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
