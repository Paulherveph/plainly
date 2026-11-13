/**
 * Lighthouse (mobile) on the given paths of a running production build (docs/QUALITY_GATE.md section 4).
 *   BASE=http://localhost:3102 node scripts/lighthouse.mjs /en          # headless Chromium: software renderer, so the static orb
 *   BASE=http://localhost:3102 node scripts/lighthouse.mjs --gpu /en    # same, with the machine's real GPU, so the live orb runs
 * Writes docs/gate-reports/<STAGE>/lighthouse-<path>[-gpu].json and prints the four scores and the web vitals.
 * Exit code 1 when a score is under the gate (performance 90, accessibility 100, best practices 95, SEO 95).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";

const BASE = process.env.BASE ?? "http://localhost:3102";
const OUT = `docs/gate-reports/${process.env.STAGE ?? "S1"}`;
const PORT = 9333;
const args = process.argv.slice(2);
const gpu = args.includes("--gpu");
const paths = args.filter((a) => !a.startsWith("--"));
if (paths.length === 0) paths.push("/en");
mkdirSync(OUT, { recursive: true });

const gpuFlags = gpu ? ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu"] : [];
const browser = await chromium.launch({ args: [`--remote-debugging-port=${PORT}`, ...gpuFlags] });
const context = await browser.newContext();
await context.newPage();

let failed = false;
for (const path of paths) {
  const run = await lighthouse(`${BASE}${path}`, { port: PORT, output: "json", logLevel: "error" });
  if (!run) throw new Error(`no Lighthouse result for ${path}`);
  const { categories, audits } = run.lhr;
  const name = `${path.replaceAll("/", "-").replace(/^-/, "")}${gpu ? "-gpu" : ""}`;
  writeFileSync(`${OUT}/lighthouse-${name}.json`, run.report);
  const score = (id) => Math.round((categories[id]?.score ?? 0) * 100);
  const line = {
    path: `${path}${gpu ? " (real GPU, live orb)" : ""}`,
    performance: score("performance"),
    accessibility: score("accessibility"),
    bestPractices: score("best-practices"),
    seo: score("seo"),
    lcpMs: Math.round(audits["largest-contentful-paint"]?.numericValue ?? 0),
    cls: Number((audits["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3)),
    tbtMs: Math.round(audits["total-blocking-time"]?.numericValue ?? 0),
    lcpElement: audits[
      "largest-contentful-paint-element"
    ]?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 60),
  };
  console.log(JSON.stringify(line));
  if (line.performance < 90 || line.accessibility < 100 || line.bestPractices < 95 || line.seo < 95)
    failed = true;
}
await browser.close();
process.exit(failed ? 1 : 0);
