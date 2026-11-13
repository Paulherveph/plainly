"use client";

import { QuoteIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Cite } from "../domain/analysis";

export function CitationChip({ cite, onOpen }: { cite: Cite; onOpen: (cite: Cite) => void }) {
  const t = useTranslations("Analysis");
  return (
    <button
      type="button"
      onClick={() => onOpen(cite)}
      aria-label={t("citation", { page: cite.page ?? "?", quote: cite.quote })}
      className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft py-0 pr-2.5 pl-2 text-brand-text text-xs transition-colors hover:border-brand/45 hover:bg-brand/20"
    >
      <QuoteIcon className="size-3 shrink-0" aria-hidden="true" />
      <span className="font-mono">p.{cite.page ?? "?"}</span>
      <span className="max-w-[28vw] truncate font-mono text-[11px] text-muted-foreground sm:max-w-44">
        {cite.quote}
      </span>
    </button>
  );
}
