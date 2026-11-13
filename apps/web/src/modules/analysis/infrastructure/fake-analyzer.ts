import type { StoredFile } from "@/modules/documents/application/ports";
import type { AppError } from "@/shared/lib/errors";
import { ok, type Result } from "@/shared/lib/result";
import type { AnalysisRun, DocumentAnalyzer } from "../application/ports";
import type { AnalysisDraft, OutputLocale, PartialAnalysis } from "../domain/analysis";
import { FIXTURES } from "./fake-fixtures";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Free, deterministic analyzer for tests, E2E and offline work (USE_FAKE_AI=true).
 * Streams like the real one: summary word by word, then one item at a time.
 */
export class FakeAnalyzer implements DocumentAnalyzer {
  readonly model = "fake";
  constructor(private readonly stepMs = 22) {}

  analyze(input: { file: StoredFile; pages: string[] | null; locale: OutputLocale }): AnalysisRun {
    const draft = draftFor(input.pages ?? [], input.locale);
    const stepMs = this.stepMs;
    let resolveFinal!: (r: Result<AnalysisDraft, AppError>) => void;
    const final = new Promise<Result<AnalysisDraft, AppError>>((r) => {
      resolveFinal = r;
    });

    async function* partials(): AsyncGenerator<PartialAnalysis> {
      const words = draft.summary.split(/(?<=\s)/);
      const current: PartialAnalysis = {
        documentType: draft.documentType,
        language: draft.language,
        summary: "",
      };
      for (let i = 0; i < words.length; i += 3) {
        current.summary = words.slice(0, i + 3).join("");
        yield structuredClone(current);
        await sleep(stepMs);
      }
      for (const key of ["keyFacts", "actions", "watchOuts", "glossary"] as const) {
        const list: unknown[] = [];
        (current as Record<string, unknown>)[key] = list;
        for (const item of draft[key]) {
          list.push(item);
          yield structuredClone(current);
          await sleep(stepMs * 3);
        }
      }
      resolveFinal(ok(draft));
    }

    // Resolve even if nobody consumes the stream (e.g. the client disconnected).
    const iterable = partials();
    const tee = teeOnce(iterable, () => resolveFinal(ok(draft)));
    return { partials: tee, final };
  }

  async transcribe(): Promise<Result<string[], AppError>> {
    return ok(["(image transcription is not available with the fake analyzer)"]);
  }
}

function draftFor(pages: string[], locale: OutputLocale): AnalysisDraft {
  const text = pages.join("\n");
  const fixture = FIXTURES.find((f) => text.includes(f.marker));
  if (fixture) return { ...fixture.draft, summary: fixture.summary[locale] };
  return genericDraft(pages);
}

/** For any other text: quote its own sentences so every claim verifies. */
function genericDraft(pages: string[]): AnalysisDraft {
  const sentences = pages.flatMap((page, i) =>
    page
      .split(/(?<=[.!?。])\s+/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length >= 20)
      .map((s) => ({ page: i + 1, text: s.slice(0, 200) })),
  );
  const pick = sentences.slice(0, 3);
  return {
    documentType: "Document",
    language: "other",
    summary:
      pick
        .map((s) => s.text)
        .join(" ")
        .slice(0, 590) || "This document has little readable text.",
    keyFacts: pick.map((s, i) => ({
      label: `Point ${i + 1}`,
      value: s.text.slice(0, 80),
      cite: { page: s.page, quote: s.text },
    })),
    actions: [],
    watchOuts: [],
    glossary: [],
  };
}

/** Runs `onAbandon` if the consumer stops iterating early, so `final` always settles. */
function teeOnce<T>(source: AsyncGenerator<T>, onAbandon: () => void): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      let finished = false;
      try {
        for await (const v of source) yield v;
        finished = true;
      } finally {
        if (!finished) onAbandon();
      }
    },
  };
}
