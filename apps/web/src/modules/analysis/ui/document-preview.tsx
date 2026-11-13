"use client";

import { cn } from "cn";
import { FileIcon, TextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaType } from "@/modules/documents/domain/document";
import { Button } from "@/shared/ui/button";
import type { Cite } from "../domain/analysis";
import { findQuoteRange, reflowPage } from "../domain/quote-range";

type View = "original" | "text";

export function DocumentPreview({
  documentId,
  mediaType,
  pages,
  highlight,
  className,
}: {
  documentId: string;
  mediaType: MediaType;
  pages: string[] | null;
  highlight: Cite | null;
  className?: string;
}) {
  const t = useTranslations("Analysis");
  const display = useMemo(() => pages?.map(reflowPage) ?? null, [pages]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(1);
  // Pasted text has no separate original: the text view is the document.
  const hasOriginal = mediaType !== "text/plain";
  const [view, setView] = useState<View>(hasOriginal && !highlight ? "original" : "text");
  const showingText = view === "text";
  const toggleLabel = showingText ? t("showOriginal") : t("showText");

  function goTo(page: number) {
    setCurrent(page);
    const box = scrollRef.current;
    const mark = box?.querySelector<HTMLElement>("mark[data-hl]");
    const target =
      mark && highlight?.page === page ? mark : box?.querySelector<HTMLElement>(`[data-page="${page}"]`);
    if (!box || !target) return;
    const offset = target.offsetTop - (mark && target === mark ? box.clientHeight / 3 : 16);
    box.scrollTo({
      top: Math.max(0, offset),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  // A cited quote can only be highlighted in the extracted text, so a new citation switches to it.
  useEffect(() => {
    if (highlight) setView("text");
  }, [highlight]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll once the text view shows the highlighted quote
  useEffect(() => {
    if (showingText && highlight?.page) requestAnimationFrame(() => goTo(highlight.page ?? 1));
  }, [highlight, showingText]);

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border bg-surface", className)}>
      <div
        data-slot="preview-header"
        className="flex items-center justify-between gap-2.5 border-b px-3.5 py-3"
      >
        <span className="flex items-center gap-2 font-medium text-[13px]">
          {showingText ? (
            <TextIcon className="size-4" aria-hidden="true" />
          ) : (
            <FileIcon className="size-4" aria-hidden="true" />
          )}
          {showingText && hasOriginal ? t("extractedText") : t("original")}
        </span>
        {showingText && pages && pages.length > 1 ? (
          <nav aria-label={t("preview")} className="flex gap-1">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-current={current === i + 1 ? "true" : undefined}
                aria-label={t("pageOf", { page: i + 1, total: pages.length })}
                onClick={() => goTo(i + 1)}
                className="h-6.5 min-w-6.5 rounded-md px-1.5 text-muted-foreground text-xs aria-[current=true]:bg-surface-2 aria-[current=true]:text-foreground aria-[current=true]:shadow-[0_0_0_1px_var(--line-strong)]"
              >
                {i + 1}
              </button>
            ))}
          </nav>
        ) : null}
        {hasOriginal ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setView(showingText ? "original" : "text")}
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            {showingText ? (
              <FileIcon key="file" className="motion-safe:animate-icon-in" />
            ) : (
              <TextIcon key="text" className="motion-safe:animate-icon-in" />
            )}
          </Button>
        ) : null}
      </div>

      {hasOriginal ? (
        <OriginalFile
          src={`/api/documents/${documentId}/original`}
          mediaType={mediaType}
          title={t("original")}
          errorText={t("originalError")}
          hidden={showingText}
        />
      ) : null}

      <div
        ref={scrollRef}
        hidden={!showingText}
        className="relative grid min-h-0 flex-1 content-start gap-4.5 overflow-auto bg-bg-deep p-4.5"
      >
        {display ? (
          display.map((text, i) => (
            <article
              key={i}
              data-page={i + 1}
              aria-label={t("pageOf", { page: i + 1, total: display.length })}
              className="relative whitespace-pre-wrap rounded bg-paper px-7 pt-7 pb-10 text-[12.5px] text-paper-ink leading-[1.7] shadow-[0_10px_30px_-12px_rgb(0_0_0/0.5)]"
            >
              <PageText text={text} quote={highlight?.page === i + 1 ? highlight.quote : null} />
              <span className="absolute right-4.5 bottom-3 font-mono text-[10px] text-[#5c5c68]">
                {i + 1} / {display.length}
              </span>
            </article>
          ))
        ) : (
          <p className="py-10 text-center text-muted-foreground text-sm">{t("noText")}</p>
        )}
      </div>
    </div>
  );
}

/** The uploaded file as the user gave it. Stays mounted while hidden so it never reloads on toggle. */
function OriginalFile({
  src,
  mediaType,
  title,
  errorText,
  hidden,
}: {
  src: string;
  mediaType: MediaType;
  title: string;
  errorText: string;
  hidden: boolean;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  return (
    <div hidden={hidden} className="relative min-h-0 flex-1 bg-bg-deep">
      {state === "loading" ? (
        <div aria-hidden="true" className="absolute inset-0 p-4.5">
          <div className="skeleton-line size-full rounded" />
        </div>
      ) : null}
      {state === "error" ? (
        <p role="alert" className="py-10 text-center text-muted-foreground text-sm">
          {errorText}
        </p>
      ) : mediaType === "application/pdf" ? (
        <iframe
          src={`${src}#view=FitH`}
          title={title}
          onLoad={() => setState("ready")}
          className={cn(
            "size-full transition-opacity duration-200",
            state === "ready" ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <div className="size-full overflow-auto p-4.5">
          {/* biome-ignore lint/performance/noImgElement: private, auth-checked file; next/image would proxy and cache it */}
          <img
            src={src}
            alt={title}
            onLoad={() => setState("ready")}
            onError={() => setState("error")}
            className={cn(
              "mx-auto h-auto max-w-full rounded shadow-[0_10px_30px_-12px_rgb(0_0_0/0.5)] transition-opacity duration-200",
              state === "ready" ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      )}
    </div>
  );
}

function PageText({ text, quote }: { text: string; quote: string | null }) {
  const range = quote ? findQuoteRange(text, quote) : null;
  if (!range) return text.trim();
  return (
    <>
      {text.slice(0, range.start).trimStart()}
      <mark
        data-hl
        className="rounded-xs bg-brand/35 text-inherit shadow-[0_0_0_2px_rgb(148_120_255/0.35)] motion-safe:animate-[mark-in_600ms_ease-out]"
      >
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end).trimEnd()}
    </>
  );
}
