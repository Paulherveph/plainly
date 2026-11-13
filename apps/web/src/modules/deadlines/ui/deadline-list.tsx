"use client";

import { cn } from "cn";
import { CalendarIcon, CheckIcon, ClockIcon, DownloadIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { setDeadlineDoneAction } from "@/server/actions/deadlines";
import { Link } from "@/shared/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { LoopVideo } from "@/shared/ui/loop-video";
import { type Deadline, daysFrom, groupDeadlines } from "../domain/deadline";

export function DeadlineList({ deadlines, today }: { deadlines: Deadline[]; today: string }) {
  const t = useTranslations("Deadlines");
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [, startTransition] = useTransition();
  const [items, setOptimistic] = useOptimistic(deadlines, (state, change: { id: string; done: boolean }) =>
    state.map((d) => (d.id === change.id ? { ...d, done: change.done } : d)),
  );
  const groups = groupDeadlines(items, today);

  function toggle(d: Deadline) {
    startTransition(async () => {
      setOptimistic({ id: d.id, done: !d.done });
      const res = await setDeadlineDoneAction(d.id, !d.done);
      if (!res.ok) toast.error(t("loadError"));
    });
  }

  if (deadlines.length === 0) {
    return (
      <div className="mt-3 rounded-xl border bg-surface px-6 py-12 text-center">
        <LoopVideo
          name="loop-deadline"
          themed
          cycles={2}
          className="mx-auto mb-3.5 w-36 overflow-hidden rounded-xl"
        />
        <h2 className="font-semibold">{t("emptyTitle")}</h2>
        <p className="mt-1 text-muted-foreground text-sm">{t("emptyBody")}</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link prefetch={false} href="/documents">
            {t("emptyCta")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <fieldset className="m-0 inline-flex min-w-0 rounded-full border bg-surface p-[3px]">
          <legend className="sr-only">{t("show")}</legend>
          {(["open", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className="h-7 rounded-full px-3 font-medium text-muted-foreground text-xs hover:text-foreground aria-pressed:bg-surface-2 aria-pressed:text-foreground aria-pressed:shadow-[0_0_0_1px_var(--line-strong)]"
            >
              {t(f)}
            </button>
          ))}
        </fieldset>
        <Button asChild variant="outline" size="sm">
          <a href="/api/deadlines/ics" download>
            <DownloadIcon />
            {t("exportAll")}
          </a>
        </Button>
      </div>
      <Group title={t("overdue")} tone="critical" items={groups.overdue} today={today} onToggle={toggle} />
      <Group title={t("upcoming")} items={groups.upcoming} today={today} onToggle={toggle} />
      {filter === "all" ? (
        <Group title={t("done")} items={groups.done} today={today} onToggle={toggle} />
      ) : null}
    </>
  );
}

function Group({
  title,
  tone,
  items,
  today,
  onToggle,
}: {
  title: string;
  tone?: "critical";
  items: Deadline[];
  today: string;
  onToggle: (d: Deadline) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-7" aria-label={title}>
      <h2
        className={cn(
          "mb-2.5 flex items-center gap-2 font-medium text-[13px] text-muted-foreground uppercase tracking-[0.06em]",
          tone === "critical" && "text-critical",
        )}
      >
        {tone === "critical" ? (
          <ClockIcon className="size-3.5" aria-hidden="true" />
        ) : (
          <CalendarIcon className="size-3.5" aria-hidden="true" />
        )}
        {title}
        <span className="font-mono text-faint">{items.length}</span>
      </h2>
      <ul className="stagger overflow-hidden rounded-xl border bg-surface">
        {items.map((d, i) => (
          <Row key={d.id} d={d} i={i} today={today} onToggle={onToggle} />
        ))}
      </ul>
    </section>
  );
}

function Row({
  d,
  i,
  today,
  onToggle,
}: {
  d: Deadline;
  i: number;
  today: string;
  onToggle: (d: Deadline) => void;
}) {
  const t = useTranslations("Deadlines");
  const format = useFormatter();
  const days = daysFrom(today, d.dueOn);
  const late = !d.done && days < 0;
  return (
    <li
      data-testid="deadline"
      style={{ "--i": i } as React.CSSProperties}
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-center gap-x-3.5 gap-y-1 border-b px-4 py-3.5 transition-[background-color,opacity] last:border-b-0 hover:bg-surface-2 sm:grid-cols-[auto_88px_1fr_auto]",
        d.done && "opacity-55",
      )}
    >
      <label className="relative row-span-2 grid size-5.5 cursor-pointer place-items-center sm:row-span-1">
        <input
          type="checkbox"
          checked={d.done}
          onChange={() => onToggle(d)}
          aria-label={t("markDone", { label: d.label })}
          className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[7px] border-[1.5px] border-line-strong transition-colors checked:border-ok checked:bg-ok focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
        />
        <CheckIcon
          aria-hidden="true"
          className="pointer-events-none relative size-3.5 stroke-[2.5] text-[#06210f] opacity-0 transition-opacity peer-checked:opacity-100"
        />
      </label>
      <div className="col-start-2 row-start-2 flex items-baseline gap-1.5 text-[13px] text-muted-foreground sm:row-start-1 sm:block">
        <b className="font-medium font-mono text-foreground text-sm">
          {format.dateTime(new Date(`${d.dueOn}T00:00:00Z`), { day: "2-digit", month: "short" })}
        </b>
        <span className={cn("sm:block", late && "text-critical")}>
          {days >= 0 ? t("relative", { days }) : t("ago", { days: -days })}
        </span>
      </div>
      <div className="col-start-2 row-start-1 min-w-0 sm:col-start-3">
        <div className={cn("font-medium text-[15px]", d.done && "line-through")}>{d.label}</div>
        <div className="mt-0.5 hidden flex-wrap items-center gap-2 text-[13px] text-muted-foreground sm:flex">
          <span>
            {t("from")}{" "}
            <Link
              prefetch={false}
              href={`/documents/${d.documentId}`}
              className="text-brand-text hover:underline"
            >
              {d.documentTitle}
            </Link>
          </span>
          {late ? (
            <span className="inline-flex h-5.5 items-center gap-1 rounded-full bg-critical-soft px-2 font-medium text-critical text-xs">
              <ClockIcon className="size-3" aria-hidden="true" />
              {t("overdue")}
            </span>
          ) : null}
        </div>
      </div>
      <Button asChild variant="ghost" size="icon" className="row-span-2 sm:row-span-1">
        <a href={`/api/deadlines/ics?id=${d.id}`} download aria-label={t("download", { label: d.label })}>
          <DownloadIcon />
        </a>
      </Button>
    </li>
  );
}
