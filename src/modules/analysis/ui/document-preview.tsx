"use client";

import { cn } from "cn";
import { ExternalLinkIcon, FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getOriginalUrlAction } from "@/server/actions/analysis";
import { Button } from "@/shared/ui/button";
import type { Cite } from "../domain/analysis";
import { findQuoteRange, reflowPage } from "../domain/quote-range";

export function DocumentPreview({
  documentId,
  pages,
  highlight,
  className,
}: {
  documentId: string;
  pages: string[] | null;
  highlight: Cite | null;
  className?: string;
}) {
  const t = useTranslations("Analysis");
  const display = useMemo(() => pages?.map(reflowPage) ?? null, [pages]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(1);
  const [pending, startTransition] = useTransition();

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the highlighted quote changes
  useEffect(() => {
    if (highlight?.page) requestAnimationFrame(() => goTo(highlight.page ?? 1));
  }, [highlight]);

  function openOriginal() {
    startTransition(async () => {
      const res = await getOriginalUrlAction(documentId);
      if (res.ok) window.open(res.value, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border bg-surface", className)}>
      <div className="flex items-center justify-between gap-2.5 border-b px-3.5 py-3">
        <span className="flex items-center gap-2 font-medium text-[13px]">
          <FileTextIcon className="size-4" aria-hidden="true" />
          {t("original")}
        </span>
        {pages && pages.length > 1 ? (
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
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={openOriginal}
          disabled={pending}
          aria-label={t("openOriginal")}
        >
          <ExternalLinkIcon />
        </Button>
      </div>
      <div
        ref={scrollRef}
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
