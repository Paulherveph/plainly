import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { DocumentAnalyzer } from "@/modules/analysis/application/ports";
import { toAnalysis } from "@/modules/analysis/domain/analysis";
import { matchKey, verifyCitations } from "@/modules/analysis/domain/verify-citations";
import { FakeAnalyzer } from "@/modules/analysis/infrastructure/fake-analyzer";

/**
 * pnpm eval                      → FakeAnalyzer baseline (free, deterministic)
 * EVAL_LIVE=1 ANTHROPIC_API_KEY=… pnpm eval → Claude (costs a few cents per run)
 */
const LIVE = process.env.EVAL_LIVE === "1";
const DIR = join(process.cwd(), "evals");
const expected: Record<string, { deadlines: string[]; facts: string[] }> = JSON.parse(
  readFileSync(join(DIR, "expected.json"), "utf8"),
);
const names = readdirSync(join(DIR, "documents"))
  .filter((f) => f.endsWith(".txt"))
  .map((f) => f.replace(/\.txt$/, ""))
  .sort();

async function makeAnalyzer(): Promise<DocumentAnalyzer> {
  if (!LIVE) return new FakeAnalyzer(0);
  const { createAnthropic } = await import("@ai-sdk/anthropic");
  const { AnthropicAnalyzer } = await import("@/modules/analysis/infrastructure/anthropic-analyzer");
  const model = process.env.AI_MODEL_ANALYSIS ?? "claude-sonnet-5-5";
  return new AnthropicAnalyzer(
    createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    model,
    "claude-haiku-5-5",
  );
}

type Row = {
  doc: string;
  claims: number;
  dropped: number;
  deadlineHits: number;
  deadlineTotal: number;
  extraDates: number;
  factHits: number;
  factTotal: number;
};
const rows: Row[] = [];

describe(`analysis evals (${LIVE ? "live" : "fake"})`, () => {
  it.each(names)("%s", async (name) => {
    const text = readFileSync(join(DIR, "documents", `${name}.txt`), "utf8");
    const pages = text.split("\f");
    const analyzer = await makeAnalyzer();
    const run = analyzer.analyze({
      file: { bytes: new TextEncoder().encode(text), mediaType: "text/plain" },
      pages,
      locale: "en",
    });
    for await (const _ of run.partials) {
      // drain the stream
    }
    const draft = await run.final;
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const raw = toAnalysis(draft.value);
    const claims = raw.keyFacts.length + raw.actions.length + raw.watchOuts.length;
    const { analysis, dropped } = verifyCitations(raw, pages);

    // Invariant: every kept quote is really in the document.
    const all = matchKey(text);
    for (const item of [...analysis.keyFacts, ...analysis.actions, ...analysis.watchOuts]) {
      expect(all.includes(matchKey(item.cite.quote))).toBe(true);
    }

    const exp = expected[name] ?? { deadlines: [], facts: [] };
    const dates = new Set(analysis.actions.map((a) => a.dueOn).filter((d): d is string => d !== null));
    const haystack = matchKey(
      [analysis.summary, ...analysis.keyFacts.map((f) => `${f.label} ${f.value}`)].join(" "),
    );
    rows.push({
      doc: name,
      claims,
      dropped,
      deadlineHits: exp.deadlines.filter((d) => dates.has(d)).length,
      deadlineTotal: exp.deadlines.length,
      extraDates: [...dates].filter((d) => !exp.deadlines.includes(d)).length,
      factHits: exp.facts.filter((f) => haystack.includes(matchKey(f))).length,
      factTotal: exp.facts.length,
    });
  }, 120_000);

  afterAll(() => {
    const sum = (k: keyof Row) => rows.reduce((n, r) => n + (r[k] as number), 0);
    const pct = (a: number, b: number) => (b === 0 ? 100 : Math.round((a / b) * 1000) / 10);
    const summary = {
      mode: LIVE ? "live" : "fake",
      model: LIVE ? (process.env.AI_MODEL_ANALYSIS ?? "claude-sonnet-5-5") : "fake",
      documents: rows.length,
      deadlineRecall: pct(sum("deadlineHits"), sum("deadlineTotal")),
      factRecall: pct(sum("factHits"), sum("factTotal")),
      quoteVerificationPassRate: pct(sum("claims") - sum("dropped"), sum("claims")),
      unexpectedDates: sum("extraDates"),
      ranAt: new Date().toISOString(),
    };
    console.table(
      rows.map((r) => ({
        doc: r.doc,
        "deadlines found": `${r.deadlineHits}/${r.deadlineTotal}`,
        "facts found": `${r.factHits}/${r.factTotal}`,
        "quotes verified": `${r.claims - r.dropped}/${r.claims}`,
        "extra dates": r.extraDates,
      })),
    );
    console.info(JSON.stringify(summary, null, 2));
    writeFileSync(
      join(DIR, `results-${summary.mode}.json`),
      `${JSON.stringify({ summary, rows }, null, 2)}\n`,
    );
    if (LIVE) {
      expect(summary.quoteVerificationPassRate).toBeGreaterThanOrEqual(90);
      expect(summary.deadlineRecall).toBeGreaterThanOrEqual(80);
    }
  });
});
