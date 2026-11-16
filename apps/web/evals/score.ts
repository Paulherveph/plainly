/**
 * Shared eval scoring (pnpm eval with the fake gateway, pnpm ai:eval with real models).
 * Thresholds: docs/AI_PROVIDERS.md section 6.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type AnalysisDraft, toAnalysis } from "@/modules/analysis/domain/analysis";
import { matchKey, verifyCitations } from "@/modules/analysis/domain/verify-citations";

export const EVAL_DIR = join(process.cwd(), "evals");

export const THRESHOLDS = {
  schemaFirstTry: 98,
  schemaFirstTryRelaxed: 95,
  quotePassRate: 95,
  deadlineRecall: 90,
  inventedDeadlines: 0,
  correctRefusals: 90,
} as const;

export type EvalDoc = { name: string; pages: string[]; deadlines: string[]; facts: string[] };

export function loadEvalDocs(): EvalDoc[] {
  const expected: Record<string, { deadlines: string[]; facts: string[] }> = JSON.parse(
    readFileSync(join(EVAL_DIR, "expected.json"), "utf8"),
  );
  return readdirSync(join(EVAL_DIR, "documents"))
    .filter((f) => f.endsWith(".txt"))
    .map((f) => f.replace(/\.txt$/, ""))
    .sort()
    .map((name) => ({
      name,
      pages: readFileSync(join(EVAL_DIR, "documents", `${name}.txt`), "utf8").split("\f"),
      deadlines: expected[name]?.deadlines ?? [],
      facts: expected[name]?.facts ?? [],
    }));
}

export function loadUnanswerable(): { doc: string; question: string }[] {
  return JSON.parse(readFileSync(join(EVAL_DIR, "unanswerable.json"), "utf8"));
}

export type DocScore = {
  doc: string;
  schemaFirstTry: boolean;
  claims: number;
  dropped: number;
  deadlineHits: number;
  deadlineTotal: number;
  /** Dates in the draft whose quote does not verify (an invented deadline). */
  inventedDeadlines: number;
  factHits: number;
  factTotal: number;
  costMicros: number;
  latencyMs: number;
};

export function scoreDoc(input: {
  doc: EvalDoc;
  draft: AnalysisDraft;
  attempts: number;
  costMicros: number;
  latencyMs: number;
}): DocScore {
  const { doc, draft } = input;
  const tightened = toAnalysis(draft);
  const { analysis, dropped } = verifyCitations(tightened, doc.pages);
  const claims = tightened.keyFacts.length + tightened.actions.length + tightened.watchOuts.length;
  const keptDates = new Set(analysis.actions.map((a) => a.dueOn).filter(Boolean));
  const draftDates = tightened.actions.map((a) => a.dueOn).filter((d): d is string => Boolean(d));
  const factText = matchKey(analysis.keyFacts.map((f) => `${f.label} ${f.value} ${f.cite.quote}`).join(" "));
  return {
    doc: doc.name,
    schemaFirstTry: input.attempts === 1,
    claims,
    dropped,
    deadlineHits: doc.deadlines.filter((d) => keptDates.has(d)).length,
    deadlineTotal: doc.deadlines.length,
    inventedDeadlines: draftDates.filter((d) => !keptDates.has(d)).length,
    factHits: doc.facts.filter((f) => factText.includes(matchKey(f))).length,
    factTotal: doc.facts.length,
    costMicros: input.costMicros,
    latencyMs: input.latencyMs,
  };
}

const pct = (a: number, b: number) => (b === 0 ? 100 : Math.round((1000 * a) / b) / 10);

export function summarize(scores: DocScore[], refusals: { correct: number; total: number }) {
  const sum = (k: keyof DocScore) => scores.reduce((n, s) => n + Number(s[k]), 0);
  const costs = scores.map((s) => s.costMicros).sort((a, b) => a - b);
  return {
    documents: scores.length,
    schemaFirstTry: pct(scores.filter((s) => s.schemaFirstTry).length, scores.length),
    quotePassRate: pct(sum("claims") - sum("dropped"), sum("claims")),
    deadlineRecall: pct(sum("deadlineHits"), sum("deadlineTotal")),
    inventedDeadlines: sum("inventedDeadlines"),
    factRecall: pct(sum("factHits"), sum("factTotal")),
    correctRefusals: pct(refusals.correct, refusals.total),
    medianCostUsd: (costs[Math.floor(costs.length / 2)] ?? 0) / 1_000_000,
    totalCostUsd: sum("costMicros") / 1_000_000,
  };
}

export type Summary = ReturnType<typeof summarize>;

export function failures(s: Summary, relaxedSchema = false): string[] {
  const out: string[] = [];
  const schema = relaxedSchema ? THRESHOLDS.schemaFirstTryRelaxed : THRESHOLDS.schemaFirstTry;
  if (s.schemaFirstTry < schema) out.push(`schema valid on first try ${s.schemaFirstTry}% < ${schema}%`);
  if (s.quotePassRate < THRESHOLDS.quotePassRate)
    out.push(`quote pass rate ${s.quotePassRate}% < ${THRESHOLDS.quotePassRate}%`);
  if (s.deadlineRecall < THRESHOLDS.deadlineRecall)
    out.push(`deadline recall ${s.deadlineRecall}% < ${THRESHOLDS.deadlineRecall}%`);
  if (s.inventedDeadlines > THRESHOLDS.inventedDeadlines)
    out.push(`invented deadlines ${s.inventedDeadlines} > 0`);
  if (s.correctRefusals < THRESHOLDS.correctRefusals)
    out.push(`correct refusals ${s.correctRefusals}% < ${THRESHOLDS.correctRefusals}%`);
  return out;
}
