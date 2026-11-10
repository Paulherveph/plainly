import { z } from "zod";
import type { Cite } from "@/modules/analysis/domain/analysis";
import { verifyCite } from "@/modules/analysis/domain/verify-citations";

export const MAX_QUESTION_CHARS = 1_000;
export const MAX_CITATIONS = 3;
export const HISTORY_TURNS = 8;

/** What the model returns for one question. */
export const ChatDraft = z.object({
  found: z.boolean().describe("true only if the document itself answers the question"),
  answer: z.string().describe("Short answer in the reader's language, or empty when not found"),
  citations: z
    .array(z.object({ page: z.number().nullable(), quote: z.string() }))
    .describe("Verbatim quotes from the document that support the answer"),
});
export type ChatDraft = z.infer<typeof ChatDraft>;

export type GroundedAnswer =
  | { kind: "answer"; text: string; citations: Cite[] }
  /** "I can't find that in this document." (localised by the UI) */
  | { kind: "refusal" };

/**
 * Grounding rule: an answer stands only if at least one of its quotes exists in the
 * document text. Otherwise it becomes a refusal, even if the model claimed it found it.
 */
export function groundAnswer(draft: ChatDraft, pages: readonly string[]): GroundedAnswer {
  const text = draft.answer.trim();
  if (!draft.found || text.length === 0) return { kind: "refusal" };
  const citations: Cite[] = [];
  for (const c of draft.citations.slice(0, MAX_CITATIONS)) {
    const verified = verifyCite({ page: c.page, quote: c.quote.trim().slice(0, 240) }, pages);
    if (verified && !citations.some((x) => x.quote === verified.quote)) citations.push(verified);
  }
  return citations.length > 0 ? { kind: "answer", text, citations } : { kind: "refusal" };
}

export function validateQuestion(question: string): string | null {
  const q = question.trim();
  return q.length === 0 || q.length > MAX_QUESTION_CHARS ? null : q;
}
