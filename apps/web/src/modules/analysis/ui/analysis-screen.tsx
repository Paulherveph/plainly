"use client";

import {
  ArrowLeftIcon,
  BookOpenIcon,
  CalendarIcon,
  CheckIcon,
  EyeIcon,
  FileTextIcon,
  InfoIcon,
  ListChecksIcon,
  RefreshCwIcon,
  ShieldIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ChatUIMessage } from "@/modules/chat/ui/chat-message";
import { ChatPanel } from "@/modules/chat/ui/chat-panel";
import type { MediaType } from "@/modules/documents/domain/document";
import { Link } from "@/shared/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { QuotaDialog } from "@/shared/ui/quota-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import type { Analysis, Cite, OutputLocale, PartialAnalysis } from "../domain/analysis";
import { DocumentPreview } from "./document-preview";
import {
  ActionsSection,
  FactsSection,
  GlossarySection,
  SectionSkeleton,
  SummarySection,
  WatchOutsSection,
} from "./sections";
import { type AnalysisState, useAnalysisStream } from "./use-analysis-stream";

const OUTPUT_LOCALES: { code: OutputLocale; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "zh", label: "中文" },
];

export type AnalysisScreenProps = {
  document: {
    id: string;
    title: string;
    kind: string | null;
    pageCount: number;
    sourceLang: string | null;
    mediaType: MediaType;
  };
  pages: string[] | null;
  locale: OutputLocale;
  initial: { analysis: Analysis; dropped: number } | null;
  /** YYYY-MM-DD, computed on the server at request time (overdue state). */
  today: string;
  /** Stored chat for this document, shown once the analysis is ready. */
  chatHistory: ChatUIMessage[];
};

export function AnalysisScreen({
  document: doc,
  pages,
  locale,
  initial,
  today,
  chatHistory,
}: AnalysisScreenProps) {
  const t = useTranslations("Analysis");
  const tc = useTranslations("Common");
  const { state, retry, continueAsGeneral } = useAnalysisStream(doc.id, locale, initial);
  const [sheetCite, setSheetCite] = useState<Cite | null>(null);
  const [highlight, setHighlight] = useState<Cite | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);

  useEffect(() => {
    if (state.status === "error" && (state.error === "quota_exceeded" || state.error === "insufficient_credits"))
      setQuotaOpen(true);
  }, [state]);

  const showOnPage = (cite: Cite) => {
    setSheetCite(null);
    setHighlight({ ...cite });
    if (!matchMedia("(min-width: 1024px)").matches) setPreviewOpen(true);
  };

  const verified = state.status === "ready";
  const data = visibleData(state);

  return (
    <div className="mx-auto max-w-[1120px] px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <header className="mb-6 flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link prefetch={false} href="/documents">
              <ArrowLeftIcon />
              {t("back")}
            </Link>
          </Button>
          <h1 className="mt-1.5 font-semibold text-2xl leading-tight tracking-tight md:text-[28px]">
            {doc.title}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {data?.documentType || doc.kind ? <Chip>{data?.documentType ?? doc.kind}</Chip> : null}
            <Chip mono>
              {languageLabel(doc.sourceLang ?? data?.language)}
              {doc.pageCount} p
            </Chip>
            <StatusLine state={state} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-faint text-[13px]">{t("explainIn")}</span>
          <nav
            aria-label={t("outputLanguage")}
            className="inline-flex rounded-full border bg-surface p-[3px]"
          >
            {OUTPUT_LOCALES.map((l) => (
              <Link
                key={l.code}
                href={{ pathname: `/documents/${doc.id}`, query: { lang: l.code } }}
                aria-current={l.code === locale ? "true" : undefined}
                lang={l.code}
                className="inline-flex h-7 min-w-9 items-center justify-center rounded-full px-2.5 font-medium text-muted-foreground text-xs hover:text-foreground aria-[current=true]:bg-surface-2 aria-[current=true]:text-foreground aria-[current=true]:shadow-[0_0_0_1px_var(--line-strong)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setPreviewOpen(true)}>
            <EyeIcon />
            {t("viewDocument")}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-7">
        <div className="flex min-w-0 flex-col gap-4">
          {state.status === "error" ? (
            <FailedCard error={state.error} incomplete={state.partial !== null} onRetry={retry} />
          ) : null}
          {state.status === "not_official" ? (
            <NotOfficialCard onContinue={continueAsGeneral} />
          ) : state.status === "error" && state.partial === null ? null : (
            <>
              {data?.summary ? (
                <SummarySection data={data} streaming={!verified} />
              ) : (
                <SectionSkeleton id="summary" title={t("summary")} icon={<FileTextIcon />} />
              )}
              {data?.keyFacts ? (
                <FactsSection data={data} verified={verified} onCite={setSheetCite} />
              ) : (
                <SectionSkeleton id="facts" title={t("keyFacts")} icon={<ListChecksIcon />} />
              )}
              {data?.actions ? (
                <ActionsSection
                  data={data}
                  verified={verified}
                  onCite={setSheetCite}
                  today={today}
                  documentId={doc.id}
                  locale={locale}
                />
              ) : (
                <SectionSkeleton id="actions" title={t("actions")} icon={<CalendarIcon />} />
              )}
              {data?.watchOuts ? (
                <WatchOutsSection data={data} verified={verified} onCite={setSheetCite} />
              ) : (
                <SectionSkeleton id="watch" title={t("watchOuts")} icon={<TriangleAlertIcon />} />
              )}
              {data?.glossary ? (
                <GlossarySection data={data} verified={verified} />
              ) : (
                <SectionSkeleton id="glossary" title={t("glossary")} icon={<BookOpenIcon />} />
              )}
              {state.status === "ready" && state.dropped > 0 ? (
                <p
                  data-testid="dropped"
                  className="flex items-center gap-2.5 rounded-[10px] border border-line-strong border-dashed px-3.5 py-2.5 text-muted-foreground text-[13px]"
                >
                  <InfoIcon className="size-4 shrink-0 text-caution" aria-hidden="true" />
                  {t("dropped", { count: state.dropped })}
                </p>
              ) : null}
              {verified ? (
                <ChatPanel
                  documentId={doc.id}
                  locale={locale}
                  initialMessages={chatHistory}
                  onCite={showOnPage}
                />
              ) : null}
            </>
          )}
          <p className="flex items-center gap-2 px-0.5 text-faint text-xs">
            <ShieldIcon className="size-3.5" aria-hidden="true" />
            {tc("notLegalAdvice")}
          </p>
        </div>

        <aside aria-label={t("preview")} className="hidden min-w-0 lg:block">
          <DocumentPreview
            documentId={doc.id}
            mediaType={doc.mediaType}
            pages={pages}
            highlight={highlight}
            className="sticky top-21 h-[calc(100dvh-104px)]"
          />
        </aside>
      </div>

      <Sheet open={sheetCite !== null} onOpenChange={(o) => !o && setSheetCite(null)}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>{t("sourceTitle")}</SheetTitle>
            <SheetDescription className="sr-only">{doc.title}</SheetDescription>
          </SheetHeader>
          {sheetCite ? (
            <div className="grid content-start gap-4.5 p-5">
              <span className="inline-flex h-6 items-center gap-1.5 justify-self-start rounded-full bg-ok-soft px-2.5 font-medium text-ok text-xs">
                <CheckIcon className="size-3" aria-hidden="true" />
                {t("quoteVerified")}
              </span>
              <blockquote className="rounded-[10px] border border-l-[3px] border-l-brand bg-background p-4 font-mono text-[13.5px] leading-relaxed">
                “{sheetCite.quote}”
              </blockquote>
              <p className="text-muted-foreground text-sm">
                {t("pageOf", { page: sheetCite.page ?? "?", total: doc.pageCount })}
              </p>
              <Button className="justify-self-start" onClick={() => showOnPage(sheetCite)}>
                <EyeIcon />
                {t("showOnPage", { page: sheetCite.page ?? 1 })}
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 rounded-t-2xl p-0 data-[side=bottom]:h-[85dvh] lg:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("preview")}</SheetTitle>
            <SheetDescription>{doc.title}</SheetDescription>
          </SheetHeader>
          <DocumentPreview
            documentId={doc.id}
            mediaType={doc.mediaType}
            pages={pages}
            highlight={highlight}
            className="h-full rounded-none border-0 [&_[data-slot=preview-header]]:pr-13"
          />
        </SheetContent>
      </Sheet>

      <QuotaDialog open={quotaOpen} onOpenChange={setQuotaOpen} />
    </div>
  );
}

function languageLabel(lang: string | null | undefined): string {
  return lang && lang !== "other" ? `${lang.toUpperCase()} · ` : "";
}

function visibleData(state: AnalysisState): PartialAnalysis | Analysis | null {
  switch (state.status) {
    case "ready":
      return state.analysis;
    case "streaming":
      return state.partial;
    case "error":
      return state.partial;
    case "not_official":
      return null;
  }
}

function Chip({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border bg-surface-2 px-2.5 font-medium text-muted-foreground text-xs ${mono ? "font-mono" : ""}`}
    >
      {children}
    </span>
  );
}

function StatusLine({ state }: { state: AnalysisState }) {
  const t = useTranslations("Analysis");
  const status = state.status;
  if (status === "error" || status === "not_official") return null;
  const note =
    state.status === "ready" && state.reason
      ? t(`reason_${state.reason}`)
      : state.status === "streaming" && state.credits
        ? t("usesCredits", { count: state.credits })
        : null;
  return (
    <span
      className="inline-flex items-center gap-2 text-muted-foreground text-[13px]"
      aria-live="polite"
      data-testid="analysis-status"
    >
      {status === "ready" ? (
        <span className="size-2 rounded-full bg-ok" aria-hidden="true" />
      ) : (
        <span
          className="size-2 animate-pulse rounded-full bg-brand shadow-[0_0_10px_var(--brand)]"
          aria-hidden="true"
        />
      )}
      {status === "ready" ? t("ready") : t("reading")}
      {note ? <span className="text-faint">· {note}</span> : null}
    </span>
  );
}

/** Typed errors with a next action. Nothing is charged for a failed run. */
const ERROR_KEYS: Record<string, string> = {
  capacity: "errorCapacity",
  ai_unavailable: "errorUnavailable",
  ai_refused: "errorRefused",
  rate_limited: "errorRateLimited",
  concurrency: "errorConcurrency",
  insufficient_credits: "errorCredits",
  quota_exceeded: "errorCredits",
};

function FailedCard({ error, incomplete, onRetry }: { error: string; incomplete: boolean; onRetry: () => void }) {
  const t = useTranslations();
  const key = ERROR_KEYS[error];
  return (
    <section role="alert" className="rounded-xl border border-critical/30 bg-critical-soft p-6">
      <h2 className="font-semibold">{t(incomplete ? "Analysis.incompleteTitle" : "Analysis.failedTitle")}</h2>
      <p className="mt-1.5 text-muted-foreground text-sm">
        {key ? t(`Analysis.${key}`) : t("Analysis.failedBody")} {t("Analysis.notCharged")}
      </p>
      {error !== "ai_refused" ? (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RefreshCwIcon />
          {incomplete ? t("Analysis.resume") : t("Common.retry")}
        </Button>
      ) : null}
    </section>
  );
}

/** A12: the text does not look like an official document. Ask before spending more. */
function NotOfficialCard({ onContinue }: { onContinue: () => void }) {
  const t = useTranslations("Analysis");
  return (
    <section className="rounded-xl border bg-surface p-6">
      <h2 className="font-semibold">{t("notOfficialTitle")}</h2>
      <p className="mt-1.5 text-muted-foreground text-sm">{t("notOfficialBody")}</p>
      <Button className="mt-4" onClick={onContinue}>
        {t("continueAnyway")}
      </Button>
    </section>
  );
}
