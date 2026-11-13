import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n/navigation";
import { Button } from "@/shared/ui/button";

export default function NotFound() {
  const t = useTranslations("Errors");
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-32 text-center md:px-8">
      <p className="font-mono text-brand-text text-sm">404</p>
      <h1 className="mt-3 font-semibold text-4xl">{t("notFoundTitle")}</h1>
      <p className="mt-3 text-muted-foreground">{t("notFoundBody")}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t("home")}</Link>
      </Button>
    </section>
  );
}
