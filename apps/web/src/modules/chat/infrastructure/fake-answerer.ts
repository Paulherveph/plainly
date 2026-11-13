import type { ChatDraft } from "../domain/grounding";

const STOP_WORDS = new Set(
  "a an and are be can do does for from have how i if in is it me my of on or the this to what when where which who will with you your".split(
    " ",
  ),
);

function terms(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (w) => w.length > 2 && !STOP_WORDS.has(w),
  );
}

/** Picks the sentence sharing the most meaningful words with the question. */
export function findBestSentence(
  pages: readonly string[],
  question: string,
): { page: number; sentence: string } | null {
  const wanted = new Set(terms(question).map((w) => w.replace(/s$/, "")));
  let best: { page: number; sentence: string; score: number } | null = null;
  pages.forEach((page, i) => {
    for (const raw of page.replace(/\s+/g, " ").split(/(?<=[.!?。])\s+/)) {
      const sentence = raw.trim();
      if (sentence.length < 12) continue;
      const score = new Set(
        terms(sentence)
          .map((w) => w.replace(/s$/, ""))
          .filter((w) => wanted.has(w)),
      ).size;
      if (score > (best?.score ?? 0)) best = { page: i + 1, sentence, score };
    }
  });
  const found = best as { page: number; sentence: string; score: number } | null;
  return found && found.score >= 1 ? { page: found.page, sentence: found.sentence } : null;
}

/** Deterministic answer for the fake AI gateway: the best matching sentence, quoted. */
export function fakeChatDraft(pages: readonly string[], question: string): ChatDraft {
  const hit = findBestSentence(pages, question);
  return hit
    ? {
        found: true,
        answer: `The document says: “${hit.sentence}”`,
        citations: [{ page: hit.page, quote: hit.sentence.slice(0, 200) }],
      }
    : { found: false, answer: "", citations: [] };
}

export function fakeChatPartials(draft: ChatDraft): { found: boolean; answer: string }[] {
  const words = draft.answer.split(/(?<=\s)/);
  const out: { found: boolean; answer: string }[] = [];
  for (let i = 1; i <= words.length; i += 2) out.push({ found: draft.found, answer: words.slice(0, i + 1).join("") });
  return out;
}
