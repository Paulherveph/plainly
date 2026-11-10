import { useTranslations } from "next-intl";

export default function DocumentsPage() {
  const t = useTranslations("Documents");
  return (
    <section className="mx-auto max-w-[1120px] px-5 pt-14 pb-24 md:px-8">
      <h1 className="font-semibold text-3xl md:text-4xl">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("sub")}</p>
    </section>
  );
}
