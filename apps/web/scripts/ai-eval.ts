/**
 * pnpm ai:eval --model anthropic:claude-sonnet-5-5 [--profile analysis|chat|fast]
 * Runs the 10 eval documents and 10 unanswerable questions against one model, checks the
 * promotion thresholds (docs/AI_PROVIDERS.md section 6) and writes evals/results/<date>-<provider>-<model>.json.
 * Real models cost money: a full run is roughly 10 analyses plus 10 short chat calls.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GatewayAnalyzer } from "@/modules/analysis/infrastructure/gateway-analyzer";
import { groundAnswer } from "@/modules/chat/domain/grounding";
import { GatewayAnswerer } from "@/modules/chat/infrastructure/gateway-answerer";
import { EVAL_DIR, failures, loadEvalDocs, loadUnanswerable, type DocScore, scoreDoc, summarize } from "../evals/score";
import { arg, gatewayFor, modelArg, recorder, usd } from "./lib";

const model = modelArg();
const profile = arg("profile", "analysis");
const usage = recorder();
const gateway = gatewayFor(model, usage);
const analyzer = new GatewayAnalyzer(gateway);
const answerer = new GatewayAnswerer(gateway);
const docs = loadEvalDocs();
const scores: DocScore[] = [];

for (const doc of docs) {
  const started = Date.now();
  const run = analyzer.analyze({
    pages: doc.pages,
    locale: "en",
    mode: profile === "fast" ? "general" : "full",
    ctx: { requestId: `eval-${doc.name}-${started}`, userId: "", documentId: "" },
  });
  for await (const _ of run.partials) {
    // drain
  }
  const final = await run.final;
  if (!final.ok) {
    console.log(`✗ ${doc.name}: ${final.error.kind}`);
    scores.push({
      doc: doc.name,
      schemaFirstTry: false,
      claims: 0,
      dropped: 0,
      deadlineHits: 0,
      deadlineTotal: doc.deadlines.length,
      inventedDeadlines: 0,
      factHits: 0,
      factTotal: doc.facts.length,
      costMicros: 0,
      latencyMs: Date.now() - started,
    });
    continue;
  }
  const s = scoreDoc({
    doc,
    draft: final.value.draft,
    attempts: final.value.usage.attempts,
    costMicros: final.value.usage.costMicros,
    latencyMs: Date.now() - started,
  });
  scores.push(s);
  console.log(`✓ ${doc.name}: ${s.claims - s.dropped}/${s.claims} quotes, deadlines ${s.deadlineHits}/${s.deadlineTotal}, ${usd(s.costMicros)}`);
}

const byName = new Map(docs.map((d) => [d.name, d]));
let correct = 0;
const questions = loadUnanswerable();
for (const q of questions) {
  const pages = byName.get(q.doc)?.pages ?? [];
  const run = answerer.answer({
    context: { kind: "whole", pages },
    history: [],
    historySummary: null,
    question: q.question,
    locale: "en",
    deep: false,
    ctx: { requestId: `eval-chat-${Date.now()}`, userId: "", documentId: "" },
  });
  for await (const _ of run.partials) {
    // drain
  }
  const final = await run.final;
  const refused = final.ok && groundAnswer(final.value.draft, pages).kind === "refusal";
  if (refused) correct++;
  console.log(`${refused ? "✓" : "✗"} unanswerable (${q.doc}): ${q.question}`);
}

const summary = summarize(scores, { correct, total: questions.length });
const failed = failures(summary, profile !== "analysis");
const date = new Date().toISOString().slice(0, 10);
const dir = join(EVAL_DIR, "results");
mkdirSync(dir, { recursive: true });
const file = join(dir, `${date}-${model.provider}-${model.model}.json`);
const totalMicros = usage.rows.reduce((n, r) => n + r.costMicros, 0);
writeFileSync(file, `${JSON.stringify({ model, profile, date, summary, failed, scores, totalCostUsd: totalMicros / 1e6 }, null, 2)}\n`);

console.log("\nSummary", summary);
console.log(`Total spend for this run: ${usd(totalMicros)}`);
console.log(`Written: ${file}`);
if (failed.length) {
  console.log(`\nNOT promotable:\n- ${failed.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nPromotable. Set evalPassedOn: "${date}" for ${model.provider}:${model.model} in src/modules/ai/domain/pricing.ts.`);
