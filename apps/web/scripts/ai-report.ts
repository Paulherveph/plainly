/**
 * pnpm ai:report [--days 7] [--update-baseline]
 * Cost and cache figures from ai_usage (service key required): median tokens and USD per analysis
 * and per chat message, cache hit rate on chat follow-ups, fallback rate. Fails (exit 1) when the
 * median cost per analysis grew more than 25% over evals/baseline.json.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { adminClient, arg, usd } from "./lib";
import { impliedMargins } from "./margin";

type Row = {
  request_id: string;
  profile: string;
  status: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cost_micros_usd: number;
};

const db = adminClient();
if (!db) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to read ai_usage.");
  process.exit(2);
}
const days = Number(arg("days", "7"));
const since = new Date(Date.now() - days * 86_400_000).toISOString();
const rows: Row[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from("ai_usage")
    .select("request_id, profile, status, input_tokens, output_tokens, cache_read_tokens, cost_micros_usd")
    .gte("created_at", since)
    .range(from, from + 999);
  if (error) {
    console.error(`ai_usage read failed: ${error.message}`);
    process.exit(1);
  }
  rows.push(...(data as Row[]));
  if (!data || data.length < 1000) break;
}

const byRequest = new Map<string, Row[]>();
for (const r of rows) byRequest.set(r.request_id, [...(byRequest.get(r.request_id) ?? []), r]);
const requests = [...byRequest.values()];
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor(s.length / 2)] ?? 0) : 0;
};
const total = (rs: Row[], k: keyof Row) => rs.reduce((n, r) => n + Number(r[k]), 0);
const isChat = (r: Row) => r.profile === "chat" || r.profile === "chat_deep";

const analyses = requests.filter((rs) => rs.some((r) => r.profile === "analysis" && r.status === "ok"));
const chats = requests.filter((rs) => rs.some((r) => isChat(r) && r.status === "ok"));
const cacheHits = chats.filter((rs) => total(rs.filter(isChat), "cache_read_tokens") > 0).length;
// More than one attempt on the request's main profile means a fallback (or a repair retry).
const withFallback = requests.filter(
  (rs) => rs.filter((r) => r.profile === rs[rs.length - 1]?.profile).length > 1,
).length;

const report = {
  days,
  requests: requests.length,
  analysis: {
    count: analyses.length,
    medianInputTokens: median(analyses.map((rs) => total(rs, "input_tokens"))),
    medianOutputTokens: median(analyses.map((rs) => total(rs, "output_tokens"))),
    medianCostUsd: median(analyses.map((rs) => total(rs, "cost_micros_usd"))) / 1e6,
  },
  chat: {
    count: chats.length,
    medianInputTokens: median(chats.map((rs) => total(rs, "input_tokens"))),
    medianOutputTokens: median(chats.map((rs) => total(rs, "output_tokens"))),
    medianCostUsd: median(chats.map((rs) => total(rs, "cost_micros_usd"))) / 1e6,
    cacheHitRatePercent: chats.length ? Math.round((100 * cacheHits) / chats.length) : 0,
  },
  fallbackRatePercent: requests.length ? Math.round((1000 * withFallback) / requests.length) / 10 : 0,
  cacheHitRows: rows.filter((r) => r.status === "cache_hit").length,
  totalCostUsd: total(rows, "cost_micros_usd") / 1e6,
};

console.log(JSON.stringify(report, null, 2));
console.log(
  `\nMedian analysis ${usd(report.analysis.medianCostUsd * 1e6)}, chat message ${usd(report.chat.medianCostUsd * 1e6)}`,
);
for (const line of impliedMargins(report.analysis.medianCostUsd, report.chat.medianCostUsd))
  console.log(line);

const baselineFile = join(process.cwd(), "evals", "baseline.json");
if (process.argv.includes("--update-baseline")) {
  const baseline = { medianAnalysisCostUsd: report.analysis.medianCostUsd, at: new Date().toISOString() };
  writeFileSync(baselineFile, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline updated: ${baselineFile}`);
} else if (existsSync(baselineFile) && report.analysis.count > 0) {
  const baseline = JSON.parse(readFileSync(baselineFile, "utf8")) as { medianAnalysisCostUsd: number };
  if (
    baseline.medianAnalysisCostUsd > 0 &&
    report.analysis.medianCostUsd > baseline.medianAnalysisCostUsd * 1.25
  ) {
    console.error(
      `Cost per analysis grew more than 25% over the baseline (${baseline.medianAnalysisCostUsd}).`,
    );
    process.exit(1);
  }
}
