"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/shared/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return (
    <section role="alert" className="mx-auto max-w-[1120px] px-5 py-32 text-center md:px-8">
      <h1 className="font-semibold text-3xl">{t("Errors.title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("Errors.body")}</p>
      <Button onClick={reset} className="mt-8">
        {t("Common.retry")}
      </Button>
    </section>
  );
}
