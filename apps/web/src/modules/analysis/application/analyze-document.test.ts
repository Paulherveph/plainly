import { describe, expect, it, vi } from "vitest";
import type { AiCall } from "@/modules/ai/application/ports";
import { FakeAiGateway, type FakeScript } from "@/modules/ai/infrastructure/fake-ai-gateway";
import type { DocumentRepository, FileStore } from "@/modules/documents/application/ports";
import type { Document } from "@/modules/documents/domain/document";
import { ok } from "@/shared/lib/result";
import type { Analysis, AnalysisDraft } from "../domain/analysis";
import { GatewayAnalyzer } from "../infrastructure/gateway-analyzer";
import { makeAnalyzeDocument } from "./analyze-document";
import type { AnalysisCache, AnalysisRepository, CreditPort, JobStore, StoredAnalysis } from "./ports";

const PAGES = ["The Tenant shall pay a security deposit of €1,700 no later than 20 November 2026."];

const baseDoc: Document = {
  id: "d1",
  userId: "u1",
  title: "Lease",
  kind: null,
  status: "uploaded",
  pageCount: 1,
  createdAt: "2026-11-11T00:00:00Z",
  expiresAt: "2026-12-11T00:00:00Z",
  mediaType: "application/pdf",
  storagePath: "u1/d1/original.pdf",
  sourceLang: null,
  pages: PAGES,
  visionPages: [],
  contentHash: "a".repeat(64),
  sampleId: null,
  chatSummary: null,
};

const draft: AnalysisDraft = {
  documentType: "Lease",
  language: "en",
  summary: "A lease.",
  keyFacts: [{ label: "Deposit", value: "€1,700", cite: { page: 1, quote: "security deposit of €1,700" } }],
  actions: [
    {
      title: "Pay",
      detail: "",
      dueOn: "2026-11-20",
      cite: { page: 1, quote: "no later than 20 November 2026" },
    },
    {
      title: "Invented",
      detail: "",
      dueOn: null,
      cite: { page: 1, quote: "the landlord pays the electricity" },
    },
  ],
  watchOuts: [],
  glossary: [],
};

const invented: AnalysisDraft = {
  ...draft,
  keyFacts: [{ label: "x", value: "y", cite: { page: 1, quote: "a sentence that is not there" } }],
  actions: [],
};

type Opts = {
  doc?: Partial<Document>;
  stored?: StoredAnalysis | null;
  other?: StoredAnalysis | null;
  cacheHit?: boolean;
  sample?: Analysis | null;
  jobRunning?: boolean;
  respond?: (call: AiCall, n: number) => unknown;
  script?: FakeScript;
  models?: string[];
  official?: boolean;
};

function setup(o: Opts = {}) {
  const doc = { ...baseDoc, ...o.doc };
  const saved: StoredAnalysis[] = [];
  let analyzeCalls = 0;
  const gateway = new FakeAiGateway(
    (call) => {
      if (call.task === "classify") return { value: { official: o.official ?? true, language: "en" } };
      if (call.task === "translate") {
        const json = JSON.parse(
          String((call.messages[0]?.content as string).split("\n").slice(1).join("\n")),
        );
        return { value: { ...json, summary: "Un bail." } };
      }
      analyzeCalls++;
      return { value: o.respond ? o.respond(call, analyzeCalls) : draft };
    },
    { script: o.script, models: o.models },
  );
  const documents = {
    getOwned: vi.fn(async () => ok(doc)),
    update: vi.fn(async () => ok(null)),
  } as unknown as DocumentRepository;
  const files = {
    read: vi.fn(async () => ok({ bytes: new Uint8Array(), mediaType: "application/pdf" })),
  } as unknown as FileStore;
  const analyses: AnalysisRepository = {
    find: vi.fn(async () => ok(o.stored ?? null)),
    findAny: vi.fn(async () => ok(o.other ?? null)),
    save: vi.fn(async (_u, a) => {
      saved.push(a);
      return ok(null);
    }),
  };
  const cache: AnalysisCache = {
    get: vi.fn(async () =>
      o.cacheHit
        ? { analysis: o.other?.analysis ?? (o.stored?.analysis as Analysis), dropped: 0, model: "m" }
        : null,
    ),
    put: vi.fn(async () => {}),
  };
  const credits: CreditPort = {
    reserve: vi.fn(async () => ok({ holdId: "h1" })),
    settle: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
  };
  const jobs: JobStore = {
    start: vi.fn(async () => ok(o.jobRunning ? null : { id: "j1" })),
    finish: vi.fn(async () => {}),
  };
  const analyze = makeAnalyzeDocument({
    documents,
    files,
    analyses,
    analyzer: new GatewayAnalyzer(gateway),
    cache,
    samples: { analysis: vi.fn(async () => o.sample ?? null) },
    jobs,
    credits,
    admission: { admit: vi.fn(async () => ok({ degraded: false })) },
    profileVersion: "test",
    translateCredits: async () => 1,
    hash: async () => "b".repeat(64),
  });
  const run = () => analyze({ userId: "u1", documentId: "d1", locale: "en", requestId: "r1" });
  return { run, gateway, saved, credits, cache, jobs, analyses };
}

async function finish(outcome: Awaited<ReturnType<ReturnType<typeof setup>["run"]>>) {
  if (!outcome.ok || outcome.value.kind !== "stream") return outcome;
  for await (const _ of outcome.value.partials) {
    // drain
  }
  return outcome.value.done;
}

const verified = (): Analysis => ({
  documentType: "Lease",
  language: "en",
  summary: "A lease.",
  keyFacts: [],
  actions: [],
  watchOuts: [],
  glossary: [],
});

describe("analyzeDocument", () => {
  it("returns a stored analysis without any model call or charge", async () => {
    const s = setup({
      stored: { documentId: "d1", locale: "en", analysis: verified(), dropped: 0, model: "m" },
    });
    const res = await s.run();
    expect(res.ok && res.value.kind).toBe("cached");
    expect(s.gateway.calls).toHaveLength(0);
    expect(s.credits.reserve).not.toHaveBeenCalled();
  });

  it("B19: a sample is served from precomputed JSON for 0 tokens", async () => {
    const s = setup({ doc: { sampleId: "lease" }, sample: verified() });
    const res = await s.run();
    expect(res.ok && res.value.kind === "cached" && res.value.reason).toBe("sample");
    expect(s.gateway.calls).toHaveLength(0);
  });

  it("A16: the same content again returns the cached result for 0 credits", async () => {
    const s = setup({
      cacheHit: true,
      other: { documentId: "x", locale: "en", analysis: verified(), dropped: 0, model: "m" },
    });
    const res = await s.run();
    expect(res.ok && res.value.kind === "cached" && res.value.reason).toBe("duplicate");
    expect(s.credits.reserve).not.toHaveBeenCalled();
  });

  it("B16: a new locale translates the existing analysis with the translate profile for 1 credit", async () => {
    const s = setup({
      other: { documentId: "d1", locale: "fr", analysis: verified(), dropped: 0, model: "m" },
    });
    const res = await s.run();
    expect(res.ok && res.value.kind === "cached" && res.value.reason).toBe("translated");
    expect(s.gateway.calls.map((c) => c.profile)).toEqual(["translate"]);
    expect(s.credits.reserve).toHaveBeenCalledWith(expect.objectContaining({ amount: 1 }));
  });

  it("verifies quotes, drops invented claims, saves, caches and settles the credits", async () => {
    const s = setup();
    const done = await finish(await s.run());
    expect(done.ok).toBe(true);
    expect(s.saved[0]?.dropped).toBe(1);
    expect(s.saved[0]?.analysis.actions.map((a) => a.title)).toEqual(["Pay"]);
    expect(s.cache.put).toHaveBeenCalled();
    expect(s.credits.settle).toHaveBeenCalledWith("h1", 3);
    expect(s.gateway.calls.map((c) => c.task)).toEqual(["classify", "analyze"]);
  });

  it("B08: everything dropped retries once on the next model, then fails without charge", async () => {
    const s = setup({ respond: () => invented });
    const done = await finish(await s.run());
    expect(done).toEqual({ ok: false, error: { kind: "ai_failed" } });
    expect(s.gateway.calls.filter((c) => c.task === "analyze").map((c) => c.startAt ?? 0)).toEqual([0, 1]);
    expect(s.credits.release).toHaveBeenCalledWith("h1");
    expect(s.credits.settle).not.toHaveBeenCalled();
  });

  it("B10: the primary model fails and the fallback answers", async () => {
    const s = setup({ models: ["primary", "fallback"], script: { failModels: new Set(["primary"]) } });
    const done = await finish(await s.run());
    expect(done.ok && done.value.model).toBe("fallback");
  });

  it("B11: all providers down means a typed error and released credits", async () => {
    const s = setup({ models: ["a", "b"], script: { failModels: new Set(["a", "b"]) } });
    const done = await finish(await s.run());
    expect(done).toEqual({ ok: false, error: { kind: "ai_unavailable" } });
    expect(s.credits.release).toHaveBeenCalled();
  });

  it("B12: a refusal is neutral and free, with no retry loop", async () => {
    const s = setup({ script: { error: "refused" } });
    const res = await s.run();
    // Classification already refuses: nothing is analyzed and nothing charged.
    if (res.ok && res.value.kind === "stream") await res.value.done;
    expect(s.credits.settle).not.toHaveBeenCalled();
  });

  it("A12: a text that is not an official document asks before spending more", async () => {
    const s = setup({ official: false });
    const res = await s.run();
    expect(res.ok && res.value.kind).toBe("not_official");
    expect(s.gateway.calls.map((c) => c.task)).toEqual(["classify"]);
    expect(s.credits.release).toHaveBeenCalledWith("h1");
  });

  it("does not start a second run of the same document and locale", async () => {
    const s = setup({ jobRunning: true });
    const res = await s.run();
    expect(res.ok && res.value.kind).toBe("running");
    expect(s.credits.reserve).not.toHaveBeenCalled();
  });

  it("A02: scanned pages are transcribed once with the fast profile, only those pages", async () => {
    const s = setup({
      doc: { pages: [PAGES[0] as string, ""], pageCount: 2, visionPages: [2] },
      respond: (call) =>
        call.task === "transcribe" ? { pages: [{ page: 2, text: "Scanned page text." }] } : draft,
    });
    await finish(await s.run());
    const transcribe = s.gateway.calls.find((c) => c.task === "transcribe");
    expect(transcribe?.profile).toBe("fast");
    expect(JSON.stringify(transcribe?.messages)).toContain("Transcribe these pages: 2.");
  });
});
