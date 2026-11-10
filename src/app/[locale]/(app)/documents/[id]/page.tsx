import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { AnalysisScreen } from "@/modules/analysis/ui/analysis-screen";
import { container } from "@/server/container";

const OutputLocale = z.enum(["en", "fr", "zh"]);

export async function generateMetadata({ params }: PageProps<"/[locale]/documents/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Analysis" });
  // Never put the document title in metadata: it can be sensitive.
  return { title: t("summary"), robots: { index: false } };
}

export default function DocumentPage(props: PageProps<"/[locale]/documents/[id]">) {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <DocumentView {...props} />
    </Suspense>
  );
}

async function DocumentView({ params, searchParams }: PageProps<"/[locale]/documents/[id]">) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  const outputLocale = OutputLocale.catch(OutputLocale.parse(locale)).parse(query.lang);

  const c = await container();
  const user = await c.currentUser();
  if (!user) notFound();
  const doc = await c.getDocument(user.id, id);
  if (!doc.ok) notFound();
  const cached = await c.findAnalysis(doc.value.id, outputLocale);
  const initial =
    cached.ok && cached.value ? { analysis: cached.value.analysis, dropped: cached.value.dropped } : null;

  return (
    <AnalysisScreen
      key={outputLocale}
      document={{
        id: doc.value.id,
        title: doc.value.title,
        kind: doc.value.kind,
        pageCount: doc.value.pageCount,
        sourceLang: doc.value.sourceLang,
      }}
      pages={doc.value.pages}
      locale={outputLocale}
      initial={initial}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}

function ScreenSkeleton() {
  return (
    <div className="mx-auto max-w-[1120px] px-5 pt-12 md:px-8" aria-hidden="true">
      <div className="skeleton-line h-8 w-2/3" />
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="grid gap-4">
          <div className="skeleton-line h-32" />
          <div className="skeleton-line h-48" />
        </div>
        <div className="skeleton-line hidden h-96 lg:block" />
      </div>
    </div>
  );
}
