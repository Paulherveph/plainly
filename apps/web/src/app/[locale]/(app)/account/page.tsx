import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { buildCalendar } from "@/modules/accounts/domain/activity";
import { AccountTabs } from "@/modules/accounts/ui/account-tabs";
import { ActivityGraph } from "@/modules/accounts/ui/activity-graph";
import { ProfileHeader } from "@/modules/accounts/ui/profile-header";
import { UpgradeCard } from "@/modules/accounts/ui/upgrade-card";
import { PlanPanel } from "@/modules/billing/ui/plan-panel";
import { container } from "@/server/container";
import { redirect } from "@/shared/i18n/navigation";
import { Skeleton } from "@/shared/ui/skeleton";

export async function generateMetadata({ params }: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("title"), robots: { index: false } };
}

export default async function AccountPage({ params, searchParams }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return (
    <section className="mx-auto max-w-[880px] px-5 pt-10 pb-24 md:px-8 md:pt-14">
      <h1 className="font-semibold text-3xl tracking-tight md:text-[40px] md:leading-[1.1]">{t("title")}</h1>
      <Suspense
        fallback={
          <div className="mt-8 grid gap-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        }
      >
        <Account
          locale={locale}
          tab={searchParams.then((p) => (typeof p.tab === "string" ? p.tab : undefined))}
        />
      </Suspense>
    </section>
  );
}

async function Account({ locale, tab }: { locale: string; tab: Promise<string | undefined> }) {
  const c = await container();
  const user = await c.currentUser();
  if (!user || user.isAnonymous) return redirect({ href: `/sign-in?next=/${locale}/account`, locale });
  const [profile, identities, balance, ledger, activity] = await Promise.all([
    c.getProfile(user.id),
    c.identities(),
    c.entitlements.balance(),
    c.ledger(200),
    c.activity(),
  ]);
  const planId = balance.ok ? balance.value.planId : null;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mt-8 grid gap-4">
      <ProfileHeader
        locale={locale}
        name={profile.ok ? profile.value.displayName : null}
        email={user.email}
        planId={planId}
        credits={balance.ok ? balance.value.planCredits + balance.value.packCredits : null}
      />
      {planId === "free" ? <UpgradeCard locale={locale} /> : null}
      <ActivityGraph calendar={buildCalendar(activity, today)} locale={locale} />
      <AccountTabs
        initialTab={await tab}
        email={user.email}
        profile={
          profile.ok ? profile.value : { userId: user.id, displayName: null, locale: "en", theme: "system" }
        }
        identities={identities}
        plan={
          balance.ok ? <PlanPanel balance={balance.value} ledger={ledger.ok ? ledger.value : []} /> : null
        }
      />
    </div>
  );
}
