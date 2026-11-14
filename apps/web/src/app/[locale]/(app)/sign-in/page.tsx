import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { alternatesFor } from "@/shared/i18n/alternates";
import { AuthShell } from "@/shared/ui/auth-shell";

export async function generateMetadata({ params }: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("pageTitle"), alternates: alternatesFor(locale, "/sign-in"), robots: { index: false } };
}

/** One page for sign in and sign up (`?mode=signup`, read on the client). The return path is validated on the client and the server. */
export default async function SignInPage({ params }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  return <AuthShell locale={locale} />;
}
