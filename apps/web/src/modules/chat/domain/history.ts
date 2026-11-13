import type { ChatTurn } from "../application/ports";

/** TOKEN_ECONOMY technique 11: keep the last 6 turns, summarize older ones above 10. */
export const KEEP_TURNS = 6;
export const SUMMARIZE_ABOVE = 10;
/** Refresh the rolling summary only after this many new old turns (keeps the fast-model cost low). */
export const SUMMARY_STEP = 4;
/** Documents up to about 8k tokens are sent whole (and cached); longer ones use page retrieval. */
export const WHOLE_DOCUMENT_MAX_CHARS = 32_000;
export const RETRIEVED_PAGES = 5;

export type RollingSummary = { covered: number; text: string };

/** Stored as "covered|text" in documents.chat_summary. */
export function parseSummary(raw: string | null): RollingSummary | null {
  if (!raw) return null;
  const bar = raw.indexOf("|");
  const covered = Number(raw.slice(0, bar));
  if (bar < 1 || !Number.isInteger(covered) || covered < 0) return null;
  return { covered, text: raw.slice(bar + 1) };
}

export const formatSummary = (s: RollingSummary): string => `${s.covered}|${s.text}`;

/**
 * Splits the history into what is sent as turns and what the summary must cover.
 * `needsRefresh` is true when enough older turns are not in the stored summary yet.
 */
export function planHistory(
  history: readonly ChatTurn[],
  summary: RollingSummary | null,
): { recent: ChatTurn[]; older: ChatTurn[]; needsRefresh: boolean } {
  if (history.length <= SUMMARIZE_ABOVE) return { recent: [...history], older: [], needsRefresh: false };
  const older = history.slice(0, history.length - KEEP_TURNS);
  const recent = history.slice(history.length - KEEP_TURNS);
  const needsRefresh = !summary || older.length - summary.covered >= SUMMARY_STEP;
  return { recent, older, needsRefresh };
}

/** Same question in other words of whitespace or case: same hash, stored answer, 0 credits. */
export function normalizeQuestion(question: string): string {
  return question
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s?？!！.。,，]+/g, " ")
    .trim();
}
