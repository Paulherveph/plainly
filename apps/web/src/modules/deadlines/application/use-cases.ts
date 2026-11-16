import type { StoredAnalysis } from "@/modules/analysis/application/ports";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import { type Deadline, deriveDeadlines } from "../domain/deadline";
import { toIcs } from "../domain/to-ics";
import type { DeadlineRepository } from "./ports";

type Deps = { deadlines: DeadlineRepository; now: () => Date };

/** After the first analysis of a document, collect its dated actions. Later locales don't duplicate them. */
export function makeCollectDeadlines({ deadlines }: Pick<Deps, "deadlines">) {
  return async (input: { userId: string; documentId: string; result: StoredAnalysis }): Promise<void> => {
    const existing = await deadlines.countForDocument(input.documentId);
    if (!existing.ok || existing.value > 0) return;
    const items = deriveDeadlines(input.result.analysis);
    if (items.length > 0) await deadlines.insertMany(input.userId, input.documentId, items);
  };
}

export function makeListDeadlines({ deadlines }: Pick<Deps, "deadlines">) {
  return (userId: string): Promise<Result<Deadline[], AppError>> => deadlines.listOwned(userId);
}

export function makeSetDeadlineDone({ deadlines }: Pick<Deps, "deadlines">) {
  return (userId: string, id: string, done: boolean): Promise<Result<null, AppError>> =>
    deadlines.setDone(userId, id, done);
}

export type IcsFilter = { id?: string; documentId?: string; dueOn?: string; includeDone?: boolean };

/** One deadline, one document's deadlines on a date, or all open deadlines, as an .ics file. */
export function makeExportDeadlines({ deadlines, now }: Deps) {
  return async (
    userId: string,
    filter: IcsFilter,
  ): Promise<Result<{ filename: string; body: string; count: number }, AppError>> => {
    const all = await deadlines.listOwned(userId);
    if (!all.ok) return all;
    const picked = all.value.filter(
      (d) =>
        (!filter.id || d.id === filter.id) &&
        (!filter.documentId || d.documentId === filter.documentId) &&
        (!filter.dueOn || d.dueOn === filter.dueOn) &&
        (filter.includeDone || filter.id || !d.done),
    );
    const body = toIcs(
      picked.map((d) => ({
        uid: d.id,
        dueOn: d.dueOn,
        title: d.label,
        description: [d.detail, d.documentTitle].filter(Boolean).join(" — "),
      })),
      { now: now() },
    );
    const filename = picked.length === 1 && filter.id ? "plainly-deadline.ics" : "plainly-deadlines.ics";
    return ok({ filename, body, count: picked.length });
  };
}

/**
 * B03/B04: a relative or ambiguous deadline becomes a dated one only when the user picks the date.
 * The label and quote come from the stored, verified analysis, never from the client.
 */
export function makeAddDeadlineFromAction(deps: {
  deadlines: DeadlineRepository;
  findAnalysis: (
    documentId: string,
    locale: "en" | "fr" | "zh",
  ) => Promise<Result<StoredAnalysis | null, AppError>>;
}) {
  return async (input: {
    userId: string;
    documentId: string;
    locale: "en" | "fr" | "zh";
    index: number;
    dueOn: string;
  }): Promise<Result<null, AppError>> => {
    const found = await deps.findAnalysis(input.documentId, input.locale);
    if (!found.ok) return found;
    const action = found.value?.analysis.actions[input.index];
    if (!action || action.dueOn !== null) return err({ kind: "not_found" });
    return deps.deadlines.insertMany(input.userId, input.documentId, [
      {
        label: action.title.slice(0, 300),
        detail: action.dueRule ?? (action.detail || null),
        dueOn: input.dueOn,
        quote: action.cite.quote,
        page: action.cite.page,
      },
    ]);
  };
}
