import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Link } from "@/shared/i18n/navigation";
import { LocaleSwitch } from "./locale-switch";
import { LogoMark } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { Skeleton } from "./skeleton";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({ account }: { account: React.ReactNode }) {
  const t = useTranslations("Nav");
  const slot = <Suspense fallback={<Skeleton className="h-8 w-32 rounded-full" />}>{account}</Suspense>;
  return (
    <header className="site-header vt-header sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="relative mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-5 md:px-8">
        <Link
          href="/"
          aria-label={t("home")}
          className="inline-flex items-center gap-2.5 font-semibold text-[17px] tracking-tight"
        >
          <LogoMark />
          Plainly
        </Link>
        <nav aria-label={t("main")} className="ml-6 hidden gap-1 lg:flex">
          <NavLinks />
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <LocaleSwitch className="hidden lg:inline-flex" />
          <ThemeToggle />
          <div className="hidden lg:block">{slot}</div>
          <MobileMenu account={slot} />
        </div>
      </div>
    </header>
  );
}
