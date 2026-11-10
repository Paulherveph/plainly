import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n/navigation";
import { LogoMark } from "./logo";

export function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="vt-footer mt-10 border-t py-10 pb-14">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-5 px-5 md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 font-semibold text-[15px]">
            <LogoMark className="size-5.5" />
            Plainly
          </Link>
          <p className="mt-2.5 text-faint text-[13px]">{t("Footer.note")}</p>
        </div>
        <nav aria-label={t("Nav.main")} className="flex flex-wrap gap-5 text-muted-foreground text-sm">
          <Link href="/documents" className="hover:text-foreground">
            {t("Nav.documents")}
          </Link>
          <Link href="/deadlines" className="hover:text-foreground">
            {t("Nav.deadlines")}
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            {t("Nav.privacy")}
          </Link>
          <Link href={{ pathname: "/", hash: "install" }} className="hover:text-foreground">
            {t("Nav.install")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
