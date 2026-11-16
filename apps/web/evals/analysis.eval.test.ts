import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FakeAiGateway } from "@/modules/ai/infrastructure/fake-ai-gateway";
import { draftFor, fakeAnalysisPartials } from "@/modules/analysis/infrastructure/fake-analyzer";
import { GatewayAnalyzer } from "@/modules/analysis/infrastructure/gateway-analyzer";
import { groundAnswer } from "@/modules/chat/domain/grounding";
import { fakeChatDraft } from "@/modules/chat/infrastructure/fake-answerer";
import { EVAL_DIR, loadEvalDocs, loadUnanswerable, scoreDoc, summarize } from "./score";

/**
 * pnpm eval: the free, deterministic baseline with the fake gateway. It checks the scoring and
 * the invariants (every kept quote exists in the text). Real models: pnpm ai:eval.
 */
describe("analysis evals (fake gateway)", () => {
  it("scores all documents and keeps only verifiable quotes", async () => {
    const docs = loadEvalDocs();
    expect(docs.length).toBeGreaterThanOrEqual(10);
    const scores = [];
    for (const doc of docs) {
      const draft = draftFor(doc.pages, "en");
      const gateway = new FakeAiGateway(() => ({ value: draft, partials: fakeAnalysisPartials(draft) }));
      const run = new GatewayAnalyzer(gateway).analyze({
        pages: doc.pages,
        locale: "en",
        mode: "full",
        ctx: { requestId: "eval", userId: "eval", documentId: doc.name },
      });
      for await (const _ of run.partials) {
        // drain
      }
      const final = await run.final;
      expect(final.ok).toBe(true);
      if (!final.ok) continue;
      scores.push(
        scoreDoc({
          doc,
          draft: final.value.draft,
          attempts: final.value.usage.attempts,
          costMicros: 0,
          latencyMs: 0,
        }),
      );
    }
    const docsByName = new Map(docs.map((d) => [d.name, d]));
    const questions = loadUnanswerable();
    const correct = questions.filter((q) => {
      const pages = docsByName.get(q.doc)?.pages ?? [];
      return groundAnswer(fakeChatDraft(pages, q.question), pages).kind === "refusal";
    }).length;
    const summary = summarize(scores, { correct, total: questions.length });
    writeFileSync(join(EVAL_DIR, "results-fake.json"), `${JSON.stringify({ summary, scores }, null, 2)}\n`);
    expect(summary.inventedDeadlines).toBe(0);
  });
});
