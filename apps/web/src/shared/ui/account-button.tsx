"use client";

import { UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n/navigation";
import { Button } from "./button";
import { SignInDialog } from "./sign-in-dialog";

/**
 * Header account slot. Member: link to the account page. Visitor: "Sign in". Guest (has a session but no
 * account yet): "Sign in" for people who already have one, and "Save your work" to create one in place.
 */
export function AccountButton({ email, isGuest }: { email: string | null; isGuest: boolean }) {
  const t = useTranslations("Nav");
  if (email) {
    return (
      <Link
        href="/account"
        prefetch={false}
        className="inline-flex h-8 items-center gap-2 rounded-full border bg-surface px-3 text-muted-foreground text-xs hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
      >
        <UserRoundIcon className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{t("account")}: </span>
        <span className="max-w-40 truncate">{email}</span>
      </Link>
    );
  }
  const signIn = (
    <Button asChild variant={isGuest ? "ghost" : "outline"} size="sm">
      <Link href="/sign-in" prefetch={false}>
        {t("signIn")}
      </Link>
    </Button>
  );
  if (!isGuest) return signIn;
  return (
    <span className="inline-flex items-center gap-1">
      {signIn}
      <SignInDialog
        trigger={
          <Button variant="outline" size="sm">
            {t("save")}
          </Button>
        }
      />
    </span>
  );
}
