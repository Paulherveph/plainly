import { describe, expect, it, vi } from "vitest";
import type { DocumentRepository, FileStore } from "@/modules/documents/application/ports";
import type { Document } from "@/modules/documents/domain/document";
import type { QuotaService } from "@/modules/quota/application/ports";
import { err, ok } from "@/shared/lib/result";
import type { AnalysisDraft } from "../domain/analysis";
import { makeAnalyzeDocument } from "./analyze-document";
import type { AnalysisRepository, DocumentAnalyzer, StoredAnalysis } from "./ports";

const PAGES = ["The Tenant shall pay a security deposit of €1,700 no later than 20 November 2026."];

const doc: Document = {
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

function setup(overrides: { cached?: StoredAnalysis; quotaOk?: boolean; final?: Promise<unknown> } = {}) {
  const saved: StoredAnalysis[] = [];
  const updates: unknown[] = [];
  const documents = {
    getOwned: vi.fn(async () => ok(doc)),
    update: vi.fn(async (_id: string, patch: unknown) => {
      updates.push(patch);
      return ok(null);
    }),
  } as unknown as DocumentRepository;
  const files = {
    read: vi.fn(async () => ok({ bytes: new Uint8Array([1]), mediaType: "application/pdf" })),
  } as unknown as FileStore;
  const analyses: AnalysisRepository = {
    find: vi.fn(async () => ok(overrides.cached ?? null)),
    save: vi.fn(async (_u: string, a: StoredAnalysis) => {
      saved.push(a);
      return ok(null);
    }),
  };
  const quota: QuotaService = {
    consume: vi.fn(async () =>
      overrides.quotaOk === false
        ? err({ kind: "quota_exceeded" as const, limit: 5 })
        : ok({ used: 1, limit: 5, remaining: 4 }),
    ),
    refund: vi.fn(async () => {}),
    status: vi.fn(),
  };
  const analyzer: DocumentAnalyzer = {
    model: "fake",
    analyze: () => ({
      partials: (async function* () {
        yield { summary: "A" };
      })(),
      final: (overrides.final ?? Promise.resolve(ok(draft))) as never,
    }),
    transcribe: vi.fn(),
  };
  const onAnalyzed = vi.fn(async () => {});
  const analyze = makeAnalyzeDocument({ documents, files, analyses, analyzer, quota, onAnalyzed });
  return { analyze, saved, updates, quota, onAnalyzed };
}

const cmd = { userId: "u1", documentId: "d1", locale: "en" as const };

describe("analyzeDocument", () => {
  it("returns the cached analysis without spending quota", async () => {
    const cached: StoredAnalysis = {
      documentId: "d1",
      locale: "en",
      analysis: {} as never,
      dropped: 0,
      model: "x",
    };
    const { analyze, quota } = setup({ cached });
    const res = await analyze(cmd);
    expect(res.ok && res.value.kind).toBe("cached");
    expect(quota.consume).not.toHaveBeenCalled();
  });

  it("stops with quota_exceeded before reading the file", async () => {
    const { analyze } = setup({ quotaOk: false });
    expect(await analyze(cmd)).toEqual({ ok: false, error: { kind: "quota_exceeded", limit: 5 } });
  });

  it("verifies quotes, drops invented claims, saves and marks ready", async () => {
    const { analyze, saved, updates, onAnalyzed } = setup();
    const res = await analyze(cmd);
    if (!res.ok || res.value.kind !== "stream") throw new Error("expected stream");
    const done = await res.value.done;
    expect(done.ok).toBe(true);
    expect(saved[0]?.dropped).toBe(1);
    expect(saved[0]?.analysis.actions.map((a) => a.title)).toEqual(["Pay"]);
    expect(updates).toContainEqual({ status: "ready", kind: "Lease", sourceLang: "en" });
    expect(onAnalyzed).toHaveBeenCalledOnce();
  });

  it("refunds quota and marks failed when the model fails", async () => {
    const { analyze, quota, updates } = setup({ final: Promise.reject(new Error("boom")) });
    const res = await analyze(cmd);
    if (!res.ok || res.value.kind !== "stream") throw new Error("expected stream");
    expect(await res.value.done).toEqual({ ok: false, error: { kind: "ai_failed" } });
    expect(quota.refund).toHaveBeenCalledWith("analysis");
    expect(updates).toContainEqual({ status: "failed" });
  });
});
