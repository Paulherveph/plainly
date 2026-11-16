"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfileAction } from "@/server/actions/account";
import { usePathname, useRouter } from "@/shared/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { type Profile, THEMES } from "../domain/profile";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "zh", label: "中文" },
] as const;

/** E10: name, language and theme, saved in the profile and applied at once. */
export function ProfileForm({ profile, email }: { profile: Profile; email: string | null }) {
  const t = useTranslations("Account");
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const [name, setName] = useState(profile.displayName ?? "");
  const [locale, setLocale] = useState(profile.locale);
  const [theme, setThemeValue] = useState(profile.theme);
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateProfileAction({ displayName: name, locale, theme });
      if (!res.ok) return void toast.error(t("saveFailed"));
      setTheme(theme);
      toast.success(t("saved"));
      if (locale !== profile.locale) router.replace(pathname, { locale });
    });
  }

  return (
    <form onSubmit={save} className="grid max-w-md gap-5 rounded-2xl border bg-surface p-5">
      {email ? (
        <p className="text-muted-foreground text-sm">
          {t("signedInAs")} <span className="font-medium text-foreground">{email}</span>
        </p>
      ) : null}
      <div className="grid gap-2">
        <label htmlFor={`${id}-name`} className="font-medium text-sm">
          {t("name")}
        </label>
        <Input id={`${id}-name`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <label htmlFor={`${id}-locale`} className="font-medium text-sm">
          {t("language")}
        </label>
        <select
          id={`${id}-locale`}
          value={locale}
          onChange={(e) => setLocale(e.target.value as Profile["locale"])}
          className="h-10 rounded-lg border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} lang={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-medium text-sm">{t("theme")}</legend>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((value) => (
            <label
              key={value}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand"
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => setThemeValue(value)}
                className="sr-only"
              />
              {t(`theme_${value}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
