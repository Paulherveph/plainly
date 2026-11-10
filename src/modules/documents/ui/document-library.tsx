"use client";

import { cn } from "cn";
import { CheckIcon, FileTextIcon, SearchIcon, XIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/shared/i18n/navigation";
import { Input } from "@/shared/ui/input";
import { type DocumentStatus, type DocumentSummary, daysUntil } from "../domain/document";

/** `now` comes from the server (request time) so rendering stays deterministic. */
export function DocumentLibrary({ documents, now }: { documents: DocumentSummary[]; now: string }) {
  const t = useTranslations("Documents");
  const format = useFormatter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const kinds = useMemo(
    () => [...new Set(documents.map((d) => d.kind).filter((k): k is string => Boolean(k)))].sort(),
    [documents],
  );
  const rows = documents.filter(
    (d) =>
      (!query || d.title.toLowerCase().includes(query.trim().toLowerCase())) && (!kind || d.kind === kind),
  );

  if (documents.length === 0) {
    return <Empty icon={<FileTextIcon />} title={t("emptyTitle")} body={t("emptyBody")} />;
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <div className="relative flex-[1_1_240px]">
          <SearchIcon
            className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-faint"
            aria-hidden="true"
          />
          <label htmlFor="lib-search" className="sr-only">
            {t("search")}
          </label>
          <Input
            id="lib-search"
            type="search"
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10.5 pl-9"
          />
        </div>
        <label htmlFor="lib-kind" className="sr-only">
          {t("filter")}
        </label>
        <select
          id="lib-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-10.5 rounded-lg border border-input bg-surface px-3.5 text-sm"
        >
          <option value="">{t("allTypes")}</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? (
        <Empty icon={<SearchIcon />} title={t("noMatchTitle")} body={t("noMatchBody")} />
      ) : (
        <ul className="mt-3 overflow-hidden rounded-xl border bg-surface">
          {rows.map((d) => (
            <li key={d.id} className="border-b last:border-b-0">
              <Link
                href={`/documents/${d.id}`}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-2"
              >
                <span className="grid size-9 place-items-center rounded-[10px] border bg-surface-2 text-muted-foreground">
                  <FileTextIcon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[15px]">{d.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-muted-foreground text-[13px]">
                    {d.kind ? (
                      <>
                        <span>{d.kind}</span>
                        <span className="text-faint">·</span>
                      </>
                    ) : null}
                    <span>
                      {format.dateTime(new Date(d.createdAt), {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-faint">·</span>
                    <span className="font-mono">{t("pages", { count: d.pageCount })}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="hidden text-faint text-xs sm:inline">
                    {t("expiresIn", { days: daysUntil(d.expiresAt, new Date(now)) })}
                  </span>
                  <StatusBadge status={d.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const t = useTranslations("Documents");
  const styles: Record<DocumentStatus, string> = {
    ready: "bg-ok-soft text-ok",
    failed: "bg-critical-soft text-critical",
    analyzing: "bg-brand-soft text-brand-text",
    uploaded: "bg-surface-2 text-muted-foreground",
  };
  const labels: Record<DocumentStatus, string> = {
    ready: t("statusReady"),
    failed: t("statusFailed"),
    analyzing: t("statusAnalyzing"),
    uploaded: t("statusUploaded"),
  };
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-medium text-xs",
        styles[status],
      )}
    >
      {status === "ready" ? <CheckIcon className="size-3" /> : null}
      {status === "failed" ? <XIcon className="size-3" /> : null}
      {status === "analyzing" ? <span className="size-1.5 animate-pulse rounded-full bg-brand" /> : null}
      {labels[status]}
    </span>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="mt-3 rounded-xl border bg-surface px-6 py-12 text-center">
      <div className="mx-auto mb-3.5 grid size-12 place-items-center rounded-2xl border bg-surface-2 text-muted-foreground [&_svg]:size-5">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-muted-foreground text-sm">{body}</p>
    </div>
  );
}
