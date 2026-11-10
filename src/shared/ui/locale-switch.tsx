"use client";

import { cn } from "cn";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/shared/i18n/navigation";
import { type Locale, routing } from "@/shared/i18n/routing";

const LABELS: Record<Locale, string> = { en: "EN", fr: "FR", zh: "中文" };

export function LocaleSwitch({ className }: { className?: string }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <fieldset className={cn("m-0 inline-flex min-w-0 rounded-full border bg-surface p-[3px]", className)}>
      <legend className="sr-only">{t("language")}</legend>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          disabled={pending}
          onClick={() => startTransition(() => router.replace(pathname, { locale: l }))}
          className="h-7 min-w-9 rounded-full px-2.5 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground aria-pressed:bg-surface-2 aria-pressed:text-foreground aria-pressed:shadow-[0_0_0_1px_var(--line-strong)]"
        >
          {LABELS[l]}
        </button>
      ))}
    </fieldset>
  );
}
