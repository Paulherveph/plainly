// Load test (docs/SCALING.md section 8): 50 virtual users against a preview with USE_FAKE_AI=true.
// Run: k6 run -e BASE_URL=https://<preview> apps/web/load/k6.js
// Optional AI path: -e COOKIE='<sb-... cookie of a test user>' -e DOCUMENT_ID=<uuid> streams a (fake) analysis.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  scenarios: {
    browse: { executor: "constant-vus", vus: 50, duration: "2m" },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:page}": ["p(95)<800"],
    "http_req_duration{kind:health}": ["p(95)<300"],
  },
};

const PAGES = ["/en", "/fr", "/zh", "/en/pricing", "/en/privacy", "/en/terms", "/en/documents"];

export default function () {
  const page = PAGES[Math.floor(Math.random() * PAGES.length)];
  const res = http.get(`${BASE}${page}`, { tags: { kind: "page" } });
  check(res, { "page 200": (r) => r.status === 200 });

  const health = http.get(`${BASE}/api/health`, { tags: { kind: "health" } });
  check(health, { "health 200": (r) => r.status === 200 });

  if (__ENV.COOKIE && __ENV.DOCUMENT_ID) {
    const analysis = http.post(
      `${BASE}/api/analysis`,
      JSON.stringify({ documentId: __ENV.DOCUMENT_ID, locale: "en" }),
      { headers: { "content-type": "application/json", cookie: __ENV.COOKIE }, tags: { kind: "analysis" }, timeout: "120s" },
    );
    check(analysis, { "analysis streamed": (r) => r.status === 200 && r.body.includes('"type":"final"') });
  }
  sleep(1);
}
