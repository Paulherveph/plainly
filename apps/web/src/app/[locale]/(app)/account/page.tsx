import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AccountTabs } from "@/modules/accounts/ui/account-tabs";
import { container } from "@/server/container";
import { redirect } from "@/shared/i18n/navigation";
import { Skeleton } from "@/shared/ui/skeleton";

export async function generateMetadata({ params }: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("title"), robots: { index: false } };
}

export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return (
    <section className="mx-auto max-w-[880px] px-5 pt-10 pb-24 md:px-8 md:pt-14">
      <h1 className="font-semibold text-3xl tracking-tight md:text-[40px] md:leading-[1.1]">{t("title")}</h1>
      <Suspense fallback={<Skeleton className="mt-8 h-96 w-full rounded-2xl" />}>
        <Account locale={locale} />
      </Suspense>
    </section>
  );
}

async function Account({ locale }: { locale: string }) {
  const c = await container();
  const user = await c.currentUser();
  if (!user || user.isAnonymous) return redirect({ href: `/sign-in?next=/${locale}/account`, locale });
  const [profile, identities] = await Promise.all([c.getProfile(user.id), c.identities()]);
  return (
    <AccountTabs
      email={user.email}
      profile={profile.ok ? profile.value : { userId: user.id, displayName: null, locale: "en", theme: "system" }}
      identities={identities}
      plan={null}
    />
  );
}
