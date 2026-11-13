import { KeyRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { alternatesFor } from "@/shared/i18n/alternates";
import { SignInForm } from "@/shared/ui/sign-in-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("pageTitle"), alternates: alternatesFor(locale, "/sign-in"), robots: { index: false } };
}

/** One page for sign in and sign up. The return path is read on the client and validated there and on the server. */
export default async function SignInPage({ params }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return (
    <section className="mx-auto grid max-w-md gap-6 px-5 pt-14 pb-24 md:pt-20">
      <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-text">
        <KeyRoundIcon className="size-5" aria-hidden="true" />
      </div>
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("body")}</p>
      </div>
      <div className="rounded-2xl border bg-surface p-5">
        <SignInForm next="from-url" />
      </div>
    </section>
  );
}
