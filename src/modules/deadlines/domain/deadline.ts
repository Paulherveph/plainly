import type { Analysis } from "@/modules/analysis/domain/analysis";

export type NewDeadline = {
  label: string;
  detail: string | null;
  dueOn: string;
  quote: string;
  page: number | null;
};

export type Deadline = NewDeadline & {
  id: string;
  documentId: string;
  documentTitle: string;
  done: boolean;
};

/** One row per action that has a date stated in the document. */
export function deriveDeadlines(analysis: Analysis): NewDeadline[] {
  return analysis.actions
    .filter((a): a is typeof a & { dueOn: string } => a.dueOn !== null)
    .map((a) => ({
      label: a.title.slice(0, 300),
      detail: a.detail || null,
      dueOn: a.dueOn,
      quote: a.cite.quote,
      page: a.cite.page,
    }));
}

export function isOverdue(d: Pick<Deadline, "dueOn" | "done">, today: string): boolean {
  return !d.done && d.dueOn < today;
}

/** Whole days from `today` to `dueOn` (both YYYY-MM-DD), negative when past. */
export function daysFrom(today: string, dueOn: string): number {
  return Math.round((Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function groupDeadlines(items: readonly Deadline[], today: string) {
  const sorted = [...items].sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.label.localeCompare(b.label));
  return {
    overdue: sorted.filter((d) => isOverdue(d, today)),
    upcoming: sorted.filter((d) => !d.done && d.dueOn >= today),
    done: sorted.filter((d) => d.done),
  };
}
