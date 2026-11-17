import { cn } from "cn";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ActivityCalendar, CalendarCell } from "../domain/activity";

/** Green scale for the activity graph (DESIGN.md: the one place green means activity, not severity). */
const LEVEL: Record<CalendarCell["level"], string> = {
  0: "bg-surface-2",
  1: "bg-ok/25",
  2: "bg-ok/45",
  3: "bg-ok/70",
  4: "bg-ok",
};

const CELL = "size-[11px] rounded-[3px] md:size-3";

/** GitHub-style contribution calendar: documents explained and questions asked per day, last 12 months. */
export async function ActivityGraph({ calendar, locale }: { calendar: ActivityCalendar; locale: string }) {
  const t = await getTranslations({ locale, namespace: "Account" });
  const format = await getFormatter({ locale });
  const dayLabel = (day: string) =>
    format.dateTime(new Date(`${day}T00:00:00Z`), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  const monthLabel = (month: number) =>
    format.dateTime(new Date(Date.UTC(2026, month, 1)), { month: "short", timeZone: "UTC" });
  const weekdays = [0, 2, 4].map((d) =>
    format.dateTime(new Date(Date.UTC(2026, 10, 16 + d)), { weekday: "short", timeZone: "UTC" }),
  );
  const stats = [
    { label: t("statActions"), value: format.number(calendar.total) },
    { label: t("statActiveDays"), value: format.number(calendar.activeDays) },
    { label: t("statCurrentStreak"), value: t("streakDays", { count: calendar.currentStreak }) },
    { label: t("statLongestStreak"), value: t("streakDays", { count: calendar.longestStreak }) },
  ];

  return (
    <section aria-labelledby="activity-title" className="min-w-0 rounded-2xl border bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="activity-title" className="font-semibold text-lg">
            {t("activityTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("activitySubtitle")}</p>
        </div>
        <p className="text-muted-foreground text-sm tabular-nums">
          {t("activityBreakdown", { analyses: calendar.analyses, questions: calendar.questions })}
        </p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-surface-2/60 px-3.5 py-3">
            <dt className="text-muted-foreground text-xs">{s.label}</dt>
            <dd className="mt-1 font-semibold text-xl tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {/* Scrolls sideways on phones; dir=rtl keeps today's end in view, the grid itself stays ltr. */}
      <div className="-mx-1 mt-5 overflow-x-auto px-1 pb-1" dir="rtl">
        <div dir="ltr" className="inline-grid min-w-max grid-cols-[auto_1fr] gap-x-2">
          <span />
          <div className="relative h-4 text-[11px] text-faint" aria-hidden="true">
            {calendar.months.map((m) => (
              <span
                key={`${m.index}-${m.month}`}
                className="absolute"
                style={{ left: `calc(${m.index} * (100% / 53))` }}
              >
                {monthLabel(m.month)}
              </span>
            ))}
          </div>
          <div
            className="grid grid-rows-7 gap-[3px] pr-1 text-[11px] text-faint leading-[11px] md:leading-3"
            aria-hidden="true"
          >
            <span />
            <span>{weekdays[0]}</span>
            <span />
            <span>{weekdays[1]}</span>
            <span />
            <span>{weekdays[2]}</span>
            <span />
          </div>
          {/* One labelled image for screen readers; each square keeps its own hover tooltip. */}
          <ol
            className="flex gap-[3px]"
            role="img"
            aria-label={t("activityTotal", { count: calendar.total })}
            data-testid="activity-graph"
          >
            {calendar.weeks.map((week, w) => (
              <li
                key={week[0]?.day ?? w}
                className="activity-week grid grid-rows-7 gap-[3px]"
                style={{ "--i": w } as React.CSSProperties}
              >
                {week.map((cell) =>
                  cell.future ? (
                    <span key={cell.day} className={CELL} />
                  ) : (
                    <span
                      key={cell.day}
                      data-level={cell.level}
                      data-day={cell.day}
                      title={t("cellLabel", { count: cell.count, date: dayLabel(cell.day) })}
                      className={cn(CELL, LEVEL[cell.level], "ring-1 ring-foreground/5 ring-inset")}
                    />
                  ),
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-faint text-xs">
        <p>{calendar.total === 0 ? t("activityEmpty") : t("activityTotal", { count: calendar.total })}</p>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span>{t("less")}</span>
          {([0, 1, 2, 3, 4] as const).map((l) => (
            <span key={l} className={cn(CELL, LEVEL[l])} />
          ))}
          <span>{t("more")}</span>
        </div>
      </div>
    </section>
  );
}
