/**
 * Production smoke test (docs/QUALITY_GATE.md S7). No dependencies, no account, no AI spend.
 *   pnpm smoke https://plainly.example
 * Checks public pages in every locale, health, security headers, SEO files, that app pages create
 * no user on view, that protected APIs refuse anonymous calls, and that dev-only routes are absent.
 * Exit code 1 on any failure.
 */
const BASE = (process.argv[2] ?? process.env.BASE_URL ?? "").replace(/\/$/, "");
if (!BASE) {
  console.error("Usage: pnpm smoke <base url>");
  process.exit(2);
}

const results = [];
async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, ms: Date.now() - started, error: message });
  }
}
const expect = (cond, message) => {
  if (!cond) throw new Error(message);
};
const get = (path, init) => fetch(`${BASE}${path}`, { redirect: "manual", ...init });
/** A message key printed instead of its text, e.g. "Pricing.title". */
const RAW_KEY = /\b(Landing|Analysis|Billing|Pricing|Auth|Account|Terms|Privacy|Documents|Chat|Nav)\.[a-zA-Z_]+\b/;

for (const locale of ["en", "fr", "zh"]) {
  for (const path of ["", "/pricing", "/privacy", "/terms", "/documents", "/deadlines", "/sign-in"]) {
    await check(`GET /${locale}${path}`, async () => {
      const res = await get(`/${locale}${path}`);
      expect(res.status === 200, `status ${res.status}`);
      const html = await res.text();
      expect(html.includes(`lang="${locale}"`), "missing lang attribute");
      const text = (html.match(/<main[\s\S]*<\/main>/)?.[0] ?? "").replace(/<[^>]+>/g, " ");
      expect(!RAW_KEY.test(text), `raw message key visible: ${text.match(RAW_KEY)?.[0]}`);
    });
  }
}

await check("app pages create no user on view (E01)", async () => {
  const res = await get("/en/documents");
  const cookies = res.headers.getSetCookie?.() ?? [];
  expect(!cookies.some((c) => c.startsWith("sb-")), "a session cookie was set on page view");
});

await check("GET /api/health", async () => {
  const res = await get("/api/health");
  expect(res.status === 200, `status ${res.status}`);
  const body = await res.json();
  expect(body.status === "ok" && body.db === "ok", `health ${JSON.stringify(body)}`);
  expect(!/sk-|sb_secret|eyJ/.test(JSON.stringify(body)), "health leaks a secret");
});

await check("security headers", async () => {
  const h = (await get("/en")).headers;
  expect(h.get("content-security-policy")?.includes("frame-ancestors 'none'"), "CSP frame-ancestors");
  expect(h.get("content-security-policy")?.includes("object-src 'none'"), "CSP object-src");
  expect(h.get("x-content-type-options") === "nosniff", "nosniff");
  expect(h.get("strict-transport-security")?.includes("max-age="), "HSTS");
  expect(!h.get("x-powered-by"), "x-powered-by present");
});

await check("robots.txt, sitemap.xml, manifest, service worker", async () => {
  expect((await get("/robots.txt")).status === 200, "robots.txt");
  const sitemap = await (await get("/sitemap.xml")).text();
  expect(sitemap.includes("/pricing") && sitemap.includes("/terms"), "sitemap lists pricing and terms");
  expect((await get("/manifest.webmanifest")).status === 200, "manifest");
  expect((await get("/sw.js")).status === 200, "service worker");
});

await check("protected APIs refuse anonymous calls (I06)", async () => {
  const post = (path, body) =>
    get(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const analysis = await post("/api/analysis", { documentId: crypto.randomUUID(), locale: "en" });
  expect(analysis.status === 401, `analysis ${analysis.status}`);
  const chat = await post("/api/chat", {
    documentId: crypto.randomUUID(),
    locale: "en",
    messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }],
  });
  expect(chat.status === 401, `chat ${chat.status}`);
  expect((await get("/api/account/export")).status === 401, "export");
  expect((await get("/api/cron/expire")).status === 401, "cron without secret");
});

await check("webhook rejects a bad signature (I05)", async () => {
  const res = await get("/api/billing/webhook", {
    method: "POST",
    body: "{}",
    headers: { "x-fake-billing-signature": "x.y" },
  });
  expect([400, 401, 503].includes(res.status), `status ${res.status}`);
});

await check("dev-only billing simulator is not reachable", async () => {
  expect((await get("/en/dev/billing?session=x")).status === 404, "simulator reachable");
});

await check("open redirect is ignored (E13)", async () => {
  const res = await get("/auth/callback?next=//evil.example/x");
  expect(!(res.headers.get("location") ?? "").includes("evil.example"), "redirected off-site");
});

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name} (${r.ms} ms)${r.ok ? "" : ` — ${r.error}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed against ${BASE}`);
process.exit(failed.length ? 1 : 0);
