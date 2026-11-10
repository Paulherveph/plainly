import { ok } from "@/shared/lib/result";
import type { AnswerRun, DocumentAnswerer } from "../application/ports";
import type { ChatDraft } from "../domain/grounding";

const STOP_WORDS = new Set(
  "a an and are be can do does for from have how i if in is it me my of on or the this to what when where which who will with you your".split(
    " ",
  ),
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/** Deterministic, free answerer for tests and E2E (USE_FAKE_AI=true). */
export class FakeAnswerer implements DocumentAnswerer {
  constructor(private readonly stepMs = 30) {}

  answer(input: { pages: readonly string[]; question: string }): AnswerRun {
    const hit = findBestSentence(input.pages, input.question);
    const draft: ChatDraft = hit
      ? {
          found: true,
          answer: `The document says: “${hit.sentence}”`,
          citations: [{ page: hit.page, quote: hit.sentence.slice(0, 200) }],
        }
      : { found: false, answer: "", citations: [] };
    const stepMs = this.stepMs;
    let resolve!: (value: ReturnType<typeof ok<ChatDraft>>) => void;
    const final = new Promise<ReturnType<typeof ok<ChatDraft>>>((r) => {
      resolve = r;
    });
    async function* partials() {
      const words = draft.answer.split(/(?<=\s)/);
      for (let i = 1; i <= words.length; i += 2) {
        yield { found: draft.found, answer: words.slice(0, i + 1).join("") };
        await sleep(stepMs);
      }
      resolve(ok(draft));
    }
    const gen = partials();
    return {
      partials: {
        async *[Symbol.asyncIterator]() {
          try {
            yield* gen;
          } finally {
            resolve(ok(draft));
          }
        },
      },
      final,
    };
  }
}
