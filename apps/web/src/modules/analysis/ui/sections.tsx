"use client";

import { cn } from "cn";
import {
  BookOpenIcon,
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  InfoIcon,
  ListChecksIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Analysis, Cite, OutputLocale, PartialAnalysis, Severity } from "../domain/analysis";
import { CitationChip } from "./citation-chip";
import { RuleDate } from "./rule-date";

/** During streaming items are partial and unverified: show text, hide citations. */
type View = { data: PartialAnalysis | Analysis; verified: boolean; onCite: (cite: Cite) => void };

function Section({
  id,
  icon,
  title,
  count,
  busy,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  count?: number;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      aria-busy={busy}
      data-testid={`section-${id}`}
      className="animate-section-in rounded-xl border bg-surface p-5.5 md:px-6.5 md:py-6"
    >
      <h2
        id={`${id}-title`}
        className="mb-3.5 flex items-center gap-2.5 font-semibold text-base tracking-tight"
      >
        <span className="text-brand-text [&_svg]:size-4.5" aria-hidden="true">
          {icon}
        </span>
        {title}
        {count !== undefined && count > 0 ? (
          <span className="font-mono font-medium text-faint text-xs">{count}</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

export function SectionSkeleton({ id, title, icon }: { id: string; title: string; icon: React.ReactNode }) {
  return (
    <Section id={id} icon={icon} title={title} busy>
      <div className="grid gap-2.5" aria-hidden="true">
        <div className="skeleton-line w-[92%]" />
        <div className="skeleton-line w-[78%]" />
        <div className="skeleton-line w-[64%]" />
      </div>
    </Section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

export function SummarySection({
  data,
  streaming,
}: {
  data: PartialAnalysis | Analysis;
  streaming: boolean;
}) {
  const t = useTranslations("Analysis");
  return (
    <Section id="summary" icon={<FileTextIcon />} title={t("summary")} busy={streaming}>
      <p className="text-[17px] leading-relaxed" data-testid="summary-text">
        {data.summary}
        {streaming ? (
          <span className="ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse bg-brand align-[-3px]" />
        ) : null}
      </p>
    </Section>
  );
}

export function FactsSection({ data, verified, onCite }: View) {
  const t = useTranslations("Analysis");
  const facts = (data.keyFacts ?? []).filter((f) => f?.label);
  return (
    <Section id="facts" icon={<ListChecksIcon />} title={t("keyFacts")} count={facts.length} busy={!verified}>
      {facts.length === 0 ? (
        <Empty>{t("noneFacts")}</Empty>
      ) : (
        <table className="w-full border-collapse text-sm">
          <tbody>
            {facts.map((f, i) => (
              <tr key={i} className="border-t first:border-t-0">
                <th
                  scope="row"
                  className="w-[34%] py-3 pr-4 text-left align-top font-normal text-muted-foreground sm:w-[38%]"
                >
                  {f?.label}
                </th>
                <td className="py-3 align-top font-medium">
                  {f?.value}
                  {verified && f?.cite ? (
                    <div className="mt-1.5">
                      <CitationChip cite={f.cite as Cite} onOpen={onCite} />
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

/** A complete YYYY-MM-DD date, or null (a streamed partial like "2026-1" is not a date yet). */
function fullDate(value: string | null | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
}

function DateTile({ dueOn, overdue }: { dueOn: string | null; overdue: boolean }) {
  const t = useTranslations("Analysis");
  const format = useFormatter();
  if (!dueOn) {
    return (
      <div className="w-13 self-start overflow-hidden rounded-[10px] border border-line-strong bg-surface text-center">
        <div className="bg-surface-2 py-0.5 text-[10px] text-faint">—</div>
        <div className="px-0.5 py-2 text-[10px] text-faint leading-tight">{t("noDate")}</div>
      </div>
    );
  }
  const date = new Date(`${dueOn}T00:00:00Z`);
  return (
    <div className="w-13 self-start overflow-hidden rounded-[10px] border border-line-strong bg-surface text-center">
      <div
        className={cn(
          "py-0.5 font-semibold text-[10px] uppercase tracking-[0.08em]",
          overdue ? "bg-critical-soft text-critical" : "bg-brand-soft text-brand-text",
        )}
      >
        {format.dateTime(date, { month: "short" })}
      </div>
      <div className="py-1 font-mono font-semibold text-xl tracking-tight">
        {format.dateTime(date, { day: "2-digit" })}
      </div>
      <div className="pb-1 font-mono text-[9px] text-faint">{date.getUTCFullYear()}</div>
    </div>
  );
}

export function ActionsSection({
  data,
  verified,
  onCite,
  today,
  documentId,
  locale,
}: View & { today: string; documentId?: string; locale?: OutputLocale }) {
  const t = useTranslations("Analysis");
  const actions = (data.actions ?? []).filter((a) => a?.title);
  return (
    <Section
      id="actions"
      icon={<CalendarIcon />}
      title={t("actions")}
      count={actions.length}
      busy={!verified}
    >
      {actions.length === 0 ? (
        <Empty>{t("noneActions")}</Empty>
      ) : (
        <ul className="grid gap-2.5">
          {actions.map((a, i) => {
            const dueOn = fullDate(a?.dueOn);
            const overdue = Boolean(dueOn && dueOn < today);
            return (
              <li
                key={i}
                className="grid grid-cols-[auto_1fr] gap-3.5 rounded-[10px] border bg-background p-3.5 dark:bg-background"
              >
                <DateTile dueOn={dueOn} overdue={overdue} />
                <div className="min-w-0">
                  <h3 className="font-semibold text-[15px] tracking-tight">{a?.title}</h3>
                  {a?.detail ? <p className="mt-0.5 text-muted-foreground text-sm">{a.detail}</p> : null}
                  {verified ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {overdue ? (
                        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-critical-soft px-2.5 font-medium text-critical text-xs">
                          <ClockIcon className="size-3" aria-hidden="true" />
                          {t("overdue")}
                        </span>
                      ) : null}
                      {a?.cite ? <CitationChip cite={a.cite as Cite} onOpen={onCite} /> : null}
                      {dueOn && documentId ? (
                        <a
                          href={`/api/deadlines/ics?documentId=${documentId}&dueOn=${dueOn}`}
                          download
                          className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-muted-foreground text-xs transition-colors hover:bg-surface-2 hover:text-foreground"
                        >
                          <CalendarIcon className="size-3.5" aria-hidden="true" />
                          {t("addToCalendar")}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {verified && documentId && locale && !a?.dueOn && (a?.dueRule || a?.dateAmbiguous) ? (
                    <RuleDate
                      documentId={documentId}
                      locale={locale}
                      index={i}
                      rule={a.dueRule ?? null}
                      ambiguous={a.dateAmbiguous === true}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

const SEVERITY: Record<
  Severity,
  {
    icon: React.ReactNode;
    tone: string;
    badge: string;
    key: "severityCritical" | "severityCaution" | "severityInfo";
  }
> = {
  critical: {
    icon: <OctagonAlertIcon />,
    tone: "border-l-critical bg-[linear-gradient(90deg,var(--critical-soft),transparent_60%)] [&_.w-ico]:text-critical",
    badge: "bg-critical-soft text-critical",
    key: "severityCritical",
  },
  caution: {
    icon: <TriangleAlertIcon />,
    tone: "border-l-caution bg-[linear-gradient(90deg,var(--caution-soft),transparent_60%)] [&_.w-ico]:text-caution",
    badge: "bg-caution-soft text-caution",
    key: "severityCaution",
  },
  info: {
    icon: <InfoIcon />,
    tone: "border-l-brand bg-[linear-gradient(90deg,var(--brand-soft),transparent_60%)] [&_.w-ico]:text-brand-text",
    badge: "bg-brand-soft text-brand-text",
    key: "severityInfo",
  },
};

export function WatchOutsSection({ data, verified, onCite }: View) {
  const t = useTranslations("Analysis");
  const items = (data.watchOuts ?? []).filter((w) => w?.title);
  return (
    <Section
      id="watch"
      icon={<TriangleAlertIcon />}
      title={t("watchOuts")}
      count={items.length}
      busy={!verified}
    >
      {items.length === 0 ? (
        <Empty>{t("noneWatchOuts")}</Empty>
      ) : (
        <ul className="grid gap-2.5">
          {items.map((w, i) => {
            const sev = SEVERITY[(w?.severity as Severity) ?? "info"] ?? SEVERITY.info;
            return (
              <li
                key={i}
                className={cn(
                  "grid grid-cols-[auto_1fr] gap-3 rounded-[10px] border border-l-[3px] p-3.5",
                  sev.tone,
                )}
              >
                <span className="w-ico mt-0.5 [&_svg]:size-4.5" aria-hidden="true">
                  {sev.icon}
                </span>
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 font-semibold text-[15px] tracking-tight">
                    {w?.title}
                    <span
                      className={cn(
                        "inline-flex h-5.5 items-center rounded-full px-2 font-medium text-xs",
                        sev.badge,
                      )}
                    >
                      {t(sev.key)}
                    </span>
                  </h3>
                  {w?.explanation ? (
                    <p className="mt-1 text-muted-foreground text-sm">{w.explanation}</p>
                  ) : null}
                  {verified && w?.cite ? (
                    <div className="mt-2.5">
                      <CitationChip cite={w.cite as Cite} onOpen={onCite} />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

export function GlossarySection({ data, verified }: Omit<View, "onCite">) {
  const t = useTranslations("Analysis");
  const terms = (data.glossary ?? []).filter((g) => g?.term);
  return (
    <Section
      id="glossary"
      icon={<BookOpenIcon />}
      title={t("glossary")}
      count={terms.length}
      busy={!verified}
    >
      {terms.length === 0 ? (
        <Empty>{t("noneGlossary")}</Empty>
      ) : (
        <dl className="grid">
          {terms.map((g, i) => (
            <div
              key={i}
              className="grid gap-0.5 border-t py-3 first:border-t-0 first:pt-0 sm:grid-cols-[180px_1fr] sm:gap-4"
            >
              <dt className="font-medium text-sm">{g?.term}</dt>
              <dd className="text-muted-foreground text-sm">{g?.plain}</dd>
            </div>
          ))}
        </dl>
      )}
    </Section>
  );
}
