"use client";

import { GaugeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { SignInDialog } from "./sign-in-dialog";

export function QuotaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Quota");
  const [signIn, setSignIn] = useState(false);
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-text">
              <GaugeIcon className="size-5" />
            </div>
            <DialogTitle className="text-xl">{t("title")}</DialogTitle>
            <DialogDescription>{t("bodyGuest", { max: 5 })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("later")}
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                setSignIn(true);
              }}
            >
              {t("signIn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SignInDialog open={signIn} onOpenChange={setSignIn} />
    </>
  );
}
