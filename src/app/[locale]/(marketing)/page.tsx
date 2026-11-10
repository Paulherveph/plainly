import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n/navigation";
import { Button } from "@/shared/ui/button";

export default function LandingPage() {
  const t = useTranslations("Landing");
  return (
    <section className="mx-auto max-w-[1120px] px-5 pt-24 pb-16 text-center md:px-8">
      <span className="eyebrow">
        <span className="eyebrow-dot" />
        {t("eyebrow")}
      </span>
      <h1 className="text-gradient mx-auto mt-6 max-w-3xl font-semibold text-5xl leading-[1.04] tracking-[-0.045em] md:text-7xl">
        {t("titleStart")} <span className="text-brand-gradient">{t("titleEnd")}</span>
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">{t("sub")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/documents">{t("ctaSample")}</Link>
        </Button>
      </div>
    </section>
  );
}
