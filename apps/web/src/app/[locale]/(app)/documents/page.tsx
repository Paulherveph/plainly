import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DocumentInput } from "@/modules/documents/ui/document-input";
import { DocumentLibrary } from "@/modules/documents/ui/document-library";
import { LibrarySkeleton } from "@/modules/documents/ui/library-skeleton";
import { SamplePicker } from "@/modules/documents/ui/sample-picker";
import { CreditSkeleton } from "@/modules/billing/ui/credit-skeleton";
import { CreditMeter } from "@/modules/billing/ui/credit-meter";
import { container } from "@/server/container";
import { ok } from "@/shared/lib/result";
import { RevealSuspense } from "@/shared/ui/reveal-suspense";
import { SkeletonRegion } from "@/shared/ui/skeleton";

export async function generateMetadata({ params }: PageProps<"/[locale]/documents">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Documents" });
  return { title: t("title") };
}

export default async function DocumentsPage({ params }: PageProps<"/[locale]/documents">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Documents" });
  return (
    <section className="mx-auto max-w-[1120px] px-5 pt-10 pb-24 md:px-8 md:pt-14">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight md:text-[40px] md:leading-[1.1]">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("sub")}</p>
        </div>
        <RevealSuspense fallback={<CreditSkeleton />}>
          <QuotaMeter />
        </RevealSuspense>
      </div>

      <DocumentInput />

      <SectionLabel>
        {t("samplesTitle")}
        <span className="rounded-full border bg-surface-2 px-2.5 py-0.5 font-normal text-xs normal-case tracking-normal">
          {t("samplesNote")}
        </span>
      </SectionLabel>
      <SamplePicker />

      <SectionLabel>{t("libraryTitle")}</SectionLabel>
      <RevealSuspense
        fallback={
          <SkeletonRegion>
            <LibrarySkeleton />
          </SkeletonRegion>
        }
      >
        <Library />
      </RevealSuspense>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 flex items-center justify-between gap-3 font-medium text-[13px] text-muted-foreground uppercase tracking-[0.06em]">
      {children}
    </h2>
  );
}

async function QuotaMeter() {
  const c = await container();
  if (!(await c.currentUser())) return null;
  const balance = await c.entitlements.balance();
  if (!balance.ok) return null;
  return <CreditMeter balance={balance.value} variant="inline" />;
}

async function Library() {
  const t = await getTranslations("Documents");
  const c = await container();
  const user = await c.currentUser();
  // No user yet (nothing stored before the first action): an empty library, not an error.
  const docs = user ? await c.listDocuments(user.id) : ok([]);
  if (!docs?.ok) {
    return (
      <p
        role="alert"
        className="mt-4 rounded-xl border bg-surface px-4 py-6 text-center text-muted-foreground text-sm"
      >
        {t("loadError")}
      </p>
    );
  }
  return <DocumentLibrary documents={docs.value} now={new Date().toISOString()} />;
}
