import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ANALYSIS_VERSION, analysisCredits } from "@/modules/analysis/domain/credits";
import { AnalysisScreen } from "@/modules/analysis/ui/analysis-screen";
import { CONFIRM_ABOVE } from "@/modules/billing/domain/credits.config";
import { AnalysisSkeleton } from "@/modules/analysis/ui/analysis-skeleton";
import type { StoredMessage } from "@/modules/chat/application/ports";
import type { ChatUIMessage } from "@/modules/chat/ui/chat-message";
import { container } from "@/server/container";
import { RevealSuspense } from "@/shared/ui/reveal-suspense";
import { SkeletonRegion } from "@/shared/ui/skeleton";

const OutputLocale = z.enum(["en", "fr", "zh"]);

export async function generateMetadata({ params }: PageProps<"/[locale]/documents/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Analysis" });
  // Never put the document title in metadata: it can be sensitive.
  return { title: t("summary"), robots: { index: false } };
}

export default function DocumentPage(props: PageProps<"/[locale]/documents/[id]">) {
  return (
    <RevealSuspense
      fallback={
        <SkeletonRegion>
          <AnalysisSkeleton />
        </SkeletonRegion>
      }
    >
      <DocumentView {...props} />
    </RevealSuspense>
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
  const [cached, history] = await Promise.all([
    c.findAnalysis(doc.value.id, outputLocale),
    c.listMessages(doc.value.id, 50),
  ]);
  const initial =
    cached.ok && cached.value ? { analysis: cached.value.analysis, dropped: cached.value.dropped } : null;
  // Never surprise: a first analysis above the threshold shows its cost and waits for a click.
  const d = doc.value;
  const cost = analysisCredits(d.pageCount, d.pages === null ? d.pageCount : d.visionPages.length);
  const confirmCost = !initial && !d.sampleId && d.status !== "ready" && cost > CONFIRM_ABOVE ? cost : null;

  return (
    <AnalysisScreen
      key={outputLocale}
      document={{
        id: doc.value.id,
        title: doc.value.title,
        kind: doc.value.kind,
        pageCount: doc.value.pageCount,
        sourceLang: doc.value.sourceLang,
        mediaType: doc.value.mediaType,
      }}
      pages={doc.value.pages}
      locale={outputLocale}
      initial={initial}
      confirmCost={confirmCost}
      outdated={Boolean(cached.ok && cached.value && cached.value.version !== ANALYSIS_VERSION)}
      today={new Date().toISOString().slice(0, 10)}
      chatHistory={history.ok ? history.value.map(toUIMessage) : []}
    />
  );
}

function toUIMessage(m: StoredMessage): ChatUIMessage {
  return {
    id: m.id,
    role: m.role,
    parts:
      m.role === "user"
        ? [{ type: "text", text: m.text }]
        : [
            { type: "text", text: m.text },
            { type: "data-citations", data: { citations: m.citations, refused: m.refused } },
          ],
  };
}
