import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Account } from "@/server/account";
import { publicEnv } from "@/shared/config/env";
import { routing } from "@/shared/i18n/routing";
import { SiteFooter } from "@/shared/ui/site-footer";
import { SiteHeader } from "@/shared/ui/site-header";
import { ServiceWorker } from "@/shared/ui/service-worker";
import { Toaster } from "@/shared/ui/sonner";
import { ThemeProvider } from "@/shared/ui/theme-provider";
import "../globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    metadataBase: new URL(publicEnv().NEXT_PUBLIC_SITE_URL),
    title: { default: t("title"), template: "%s · Plainly" },
    description: t("description"),
    openGraph: { title: t("title"), description: t("description"), siteName: "Plainly", type: "website" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
    { media: "(prefers-color-scheme: light)", color: "#f6f6f9" },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    <html
      lang={locale === "zh" ? "zh-CN" : locale}
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} dark`}
    >
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <ThemeProvider>
            <a
              href="#main"
              className="-translate-y-20 fixed top-3 left-4 z-100 rounded-lg bg-primary px-3.5 py-2 text-primary-foreground focus:translate-y-0"
            >
              {t("skip")}
            </a>
            <SiteHeader account={<Account />} />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
            <Toaster position="bottom-center" />
            <ServiceWorker />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
