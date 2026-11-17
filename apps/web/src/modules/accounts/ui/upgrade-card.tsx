import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/shared/i18n/navigation";

/** Free users only: one dark card that leads to the pricing page (image3 style). */
export async function UpgradeCard({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Account" });
  return (
    <section className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl bg-[#14121c] p-5 text-white ring-1 ring-white/10 md:p-6 dark:bg-surface-2">
      <div
        aria-hidden="true"
        className="-top-16 -left-10 pointer-events-none absolute size-48 rounded-full bg-brand/30 blur-3xl"
      />
      <SparklesIcon className="relative size-7 shrink-0 text-[#b4a3ff]" aria-hidden="true" />
      <div className="relative min-w-0 flex-1">
        <p className="font-semibold">{t("upgradeTitle")}</p>
        <p className="text-sm text-white/70">{t("upgradeBody")}</p>
      </div>
      <Link
        href="/pricing"
        className="relative inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 font-medium text-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
      >
        {t("upgradeCta")}
        <ArrowRightIcon className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
