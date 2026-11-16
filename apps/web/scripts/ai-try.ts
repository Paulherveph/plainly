/**
 * pnpm ai:try --model anthropic:claude-sonnet-5-5 --file samples/lease.pdf [--locale fr] [--profile analysis]
 * One analysis with one model: schema, quote verification, tokens, cost, latency and the result.
 */
import { readFileSync } from "node:fs";
import { LOCALES, type OutputLocale, toAnalysis } from "@/modules/analysis/domain/analysis";
import { verifyCitations } from "@/modules/analysis/domain/verify-citations";
import { GatewayAnalyzer } from "@/modules/analysis/infrastructure/gateway-analyzer";
import { isMediaType, resolveMediaType } from "@/modules/documents/domain/document";
import { UnpdfTextExtractor } from "@/modules/documents/infrastructure/unpdf-text-extractor";
import { arg, gatewayFor, modelArg, recorder, usd } from "./lib";

const model = modelArg();
const file = arg("file");
const locale = (LOCALES.find((l) => l === arg("locale", "en")) ?? "en") as OutputLocale;
const mode = arg("profile", "analysis") === "fast" ? "general" : "full";

/** Wrapped in main(): tsx runs scripts as CommonJS here, which has no top-level await. */
async function main() {
  const bytes = new Uint8Array(readFileSync(file));
  const resolved = resolveMediaType("", file);
  const mediaType = isMediaType(resolved) ? resolved : "text/plain";
  const extracted = await new UnpdfTextExtractor().extract({ bytes, mediaType });
  if (!extracted.ok || !extracted.value.pages) {
    console.error(
      `Could not read text from ${file}: ${extracted.ok ? "no text layer (scanned)" : extracted.error}`,
    );
    process.exit(1);
  }
  const pages = extracted.value.pages;

  const usage = recorder();
  const analyzer = new GatewayAnalyzer(gatewayFor(model, usage));
  const started = Date.now();
  const run = analyzer.analyze({
    pages,
    locale,
    mode,
    ctx: { requestId: `try-${started}`, userId: "", documentId: "" },
  });
  for await (const _ of run.partials) {
    // drain
  }
  const final = await run.final;
  const ms = Date.now() - started;
  if (!final.ok) {
    console.error(`Failed: ${final.error.kind} after ${ms} ms`);
    process.exit(1);
  }
  const tightened = toAnalysis(final.value.draft);
  const { analysis, dropped } = verifyCitations(tightened, pages);
  const claims = tightened.keyFacts.length + tightened.actions.length + tightened.watchOuts.length;
  const u = final.value.usage;

  console.log(`model            ${model.provider}:${model.model}`);
  console.log(`schema valid     ${u.attempts === 1 ? "yes, first try" : `after ${u.attempts} attempts`}`);
  console.log(
    `quote pass rate  ${claims ? Math.round((100 * (claims - dropped)) / claims) : 100}% (${dropped} of ${claims} dropped)`,
  );
  console.log(
    `tokens           in ${u.inputTokens} (cache read ${u.cacheReadTokens}, write ${u.cacheWriteTokens}), out ${u.outputTokens}`,
  );
  console.log(`cost             ${usd(u.costMicros)}`);
  console.log(`latency          ${ms} ms`);
  console.log(JSON.stringify(analysis, null, 2));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
