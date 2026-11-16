/**
 * pnpm ai:samples [--model anthropic:claude-sonnet-5-5]
 * Analyzes the three built-in samples once per locale and writes samples/analyses/<id>.<locale>.json.
 * Visitors who try a sample then cost 0 tokens. Without --model it writes the deterministic fake
 * results, which is enough for local work and E2E. Commit the files after a real run.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AiGateway } from "@/modules/ai/application/ports";
import { FakeAiGateway } from "@/modules/ai/infrastructure/fake-ai-gateway";
import { LOCALES, toAnalysis } from "@/modules/analysis/domain/analysis";
import { verifyCitations } from "@/modules/analysis/domain/verify-citations";
import { draftFor, fakeAnalysisPartials } from "@/modules/analysis/infrastructure/fake-analyzer";
import { GatewayAnalyzer } from "@/modules/analysis/infrastructure/gateway-analyzer";
import { SAMPLE_IDS } from "@/modules/documents/domain/document";
import { UnpdfTextExtractor } from "@/modules/documents/infrastructure/unpdf-text-extractor";
import { gatewayFor, modelArg, recorder, usd } from "./lib";

const live = process.argv.includes("--model");
const usage = recorder();
const realGateway = live ? gatewayFor(modelArg(), usage) : null;
const dir = join(process.cwd(), "samples", "analyses");
mkdirSync(dir, { recursive: true });

for (const id of SAMPLE_IDS) {
  const bytes = new Uint8Array(readFileSync(join(process.cwd(), "samples", `${id}.pdf`)));
  const extracted = await new UnpdfTextExtractor().extract({ bytes, mediaType: "application/pdf" });
  if (!extracted.ok || !extracted.value.pages) throw new Error(`Sample ${id} has no text layer`);
  const pages = extracted.value.pages;
  for (const locale of LOCALES) {
    const gateway: AiGateway =
      realGateway ??
      new FakeAiGateway(() => {
        const draft = draftFor(pages, locale);
        return { value: draft, partials: fakeAnalysisPartials(draft) };
      });
    const run = new GatewayAnalyzer(gateway).analyze({
      pages,
      locale,
      mode: "full",
      ctx: { requestId: `sample-${id}-${locale}`, userId: "", documentId: "" },
    });
    for await (const _ of run.partials) {
      // drain
    }
    const final = await run.final;
    if (!final.ok) throw new Error(`Sample ${id}/${locale} failed: ${final.error.kind}`);
    const { analysis, dropped } = verifyCitations(toAnalysis(final.value.draft), pages);
    writeFileSync(join(dir, `${id}.${locale}.json`), `${JSON.stringify(analysis, null, 2)}\n`);
    console.log(`${id}.${locale}: ${dropped} dropped, ${usd(final.value.usage.costMicros)}`);
  }
}
console.log(`Total: ${usd(usage.rows.reduce((n, r) => n + r.costMicros, 0))}`);
