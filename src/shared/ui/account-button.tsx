"use client";

import { useTranslations } from "next-intl";
import { Button } from "./button";
import { SignInDialog } from "./sign-in-dialog";

export function AccountButton({ email }: { email: string | null }) {
  const t = useTranslations("Nav");
  if (email) {
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded-full border bg-surface px-3 text-muted-foreground text-xs">
        <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
        <span className="sr-only">{t("signedIn")}: </span>
        <span className="max-w-40 truncate">{email}</span>
      </span>
    );
  }
  return (
    <SignInDialog
      trigger={
        <Button variant="outline" size="sm">
          {t("save")}
        </Button>
      }
    />
  );
}
