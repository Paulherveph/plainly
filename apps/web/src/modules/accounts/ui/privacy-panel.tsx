"use client";

import { DownloadIcon, TrashIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAccountAction } from "@/server/actions/account";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";

/** E11 export and E12 delete account (type-to-confirm). */
export function PrivacyPanel() {
  const t = useTranslations("Account");
  const locale = useLocale();
  const id = useId();
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const word = t("deleteWord");

  function remove() {
    start(async () => {
      const res = await deleteAccountAction({ typed, locale });
      if (!res.ok) return void toast.error(t("deleteFailed"));
      window.location.assign(`/${locale}`);
    });
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="font-semibold">{t("exportTitle")}</h2>
        <p className="mt-1.5 text-muted-foreground text-sm">{t("exportBody")}</p>
        <Button asChild variant="outline" className="mt-4">
          <a href="/api/account/export" download>
            <DownloadIcon />
            {t("exportButton")}
          </a>
        </Button>
      </section>
      <section className="rounded-2xl border border-critical/30 bg-critical-soft p-5">
        <h2 className="font-semibold">{t("deleteTitle")}</h2>
        <p className="mt-1.5 text-muted-foreground text-sm">{t("deleteBody")}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" className="mt-4">
              <TrashIcon />
              {t("deleteButton")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
              <DialogDescription>{t("deleteConfirmBody", { word })}</DialogDescription>
            </DialogHeader>
            <label htmlFor={id} className="sr-only">
              {t("deleteConfirmLabel", { word })}
            </label>
            <Input id={id} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={remove}
                disabled={pending || typed.trim().toLocaleLowerCase() !== word.toLocaleLowerCase()}
              >
                {pending ? t("deleting") : t("deleteFinal")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
