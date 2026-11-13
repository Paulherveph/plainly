import type { DocumentRepository, FileStore } from "@/modules/documents/application/ports";
import { mergeTranscription, needsTranscription, normalizeForHash } from "@/modules/documents/domain/document";
import type { AppError } from "@/shared/lib/errors";
import { log, logError } from "@/shared/lib/log";
import { err, ok, type Result } from "@/shared/lib/result";
import { type Analysis, type OutputLocale, type PartialAnalysis, toAnalysis } from "../domain/analysis";
import { ANALYSIS_VERSION, analysisCredits } from "../domain/credits";
import { verifyCitations } from "../domain/verify-citations";
import type {
  AiAdmission,
  AiContext,
  AnalysisCache,
  AnalysisRepository,
  CreditPort,
  DocumentAnalyzer,
  JobStore,
  SampleAnalyses,
  StoredAnalysis,
} from "./ports";

export type AnalysisSink = {
  /** Called once a verified analysis is saved, e.g. to collect deadlines. */
  onAnalyzed?: (input: { userId: string; documentId: string; result: StoredAnalysis }) => Promise<void>;
};

type Deps = AnalysisSink & {
  documents: DocumentRepository;
  files: FileStore;
  analyses: AnalysisRepository;
  analyzer: DocumentAnalyzer;
  cache: AnalysisCache;
  samples: SampleAnalyses;
  jobs: JobStore;
  credits: CreditPort;
  admission: AiAdmission;
  /** Changes when the analysis profile's models change, so the cache does not mix models. */
  profileVersion: string;
  /** Credits for an extra locale on the user's plan (1, or 0 when the plan includes all locales). */
  translateCredits: () => Promise<number>;
  hash: (input: string) => Promise<string>;
};

export type AnalyzeCommand = {
  userId: string;
  documentId: string;
  locale: OutputLocale;
  requestId: string;
  /** "general": the user chose to continue with a text that is not an official document. */
  mode?: "auto" | "general";
};

export type CachedReason = "stored" | "sample" | "duplicate" | "translated";

export type AnalyzeOutcome =
  | { kind: "cached"; result: StoredAnalysis; reason: CachedReason }
  | { kind: "running" }
  | { kind: "not_official"; language: string }
  | {
      kind: "stream";
      credits: number;
      partials: AsyncIterable<PartialAnalysis>;
      done: Promise<Result<StoredAnalysis, AppError>>;
    };

/**
 * The analysis pipeline with cost gates (TOKEN_ECONOMY section 4):
 * stored → sample → content-hash cache → translation from another locale → admission (budget,
 * rate, concurrency) → reserve credits → transcribe scanned pages → classify → analyze →
 * verify quotes (one retry on the next model if everything is dropped) → persist → settle.
 * Any failure releases the reserved credits.
 */
export function makeAnalyzeDocument(deps: Deps) {
  return async function analyzeDocument(cmd: AnalyzeCommand): Promise<Result<AnalyzeOutcome, AppError>> {
    const stored = await deps.analyses.find(cmd.documentId, cmd.locale);
    if (!stored.ok) return stored;
    if (stored.value) return ok({ kind: "cached", result: stored.value, reason: "stored" });

    const docResult = await deps.documents.getOwned(cmd.userId, cmd.documentId);
    if (!docResult.ok) return docResult;
    const doc = docResult.value;
    const ctx: AiContext = { requestId: cmd.requestId, userId: cmd.userId, documentId: doc.id };

    const reuse = async (analysis: Analysis, dropped: number, model: string, reason: CachedReason) => {
      const result: StoredAnalysis = { documentId: doc.id, locale: cmd.locale, analysis, dropped, model };
      const saved = await deps.analyses.save(cmd.userId, result);
      if (!saved.ok) return saved;
      await deps.documents.update(doc.id, { status: "ready", kind: analysis.documentType, sourceLang: analysis.language });
      await deps.onAnalyzed?.({ userId: cmd.userId, documentId: doc.id, result });
      log("analysis.reused", { documentId: doc.id, reason });
      return ok<AnalyzeOutcome>({ kind: "cached", result, reason });
    };

    // B19: samples are served from precomputed JSON, 0 tokens.
    if (doc.sampleId) {
      const sample = await deps.samples.analysis(doc.sampleId, cmd.locale);
      if (sample) return reuse(sample, 0, "sample", "sample");
    }

    // A16: the same content analyzed before, in this locale, with the same prompt and models.
    const cacheKey = doc.contentHash
      ? `${doc.contentHash}:${cmd.locale}:${ANALYSIS_VERSION}:${deps.profileVersion}`
      : null;
    if (cacheKey) {
      const hit = await deps.cache.get(cacheKey);
      if (hit) return reuse(hit.analysis, hit.dropped, hit.model, "duplicate");
    }

    // B16: another locale exists, translate it instead of re-analyzing (quotes unchanged).
    const other = await deps.analyses.findAny(doc.id);
    if (other.ok && other.value) return translate(other.value);

    const admitted = await deps.admission.admit({ userId: cmd.userId, action: "analysis" });
    if (!admitted.ok) return admitted;
    ctx.degraded = admitted.value.degraded;

    const job = await deps.jobs.start({
      userId: cmd.userId,
      documentId: doc.id,
      kind: "analysis",
      locale: cmd.locale,
      requestId: cmd.requestId,
    });
    if (!job.ok) return job;
    if (job.value === null) return ok({ kind: "running" });
    const jobId = job.value.id;

    const credits = analysisCredits(doc.pageCount, doc.pages === null ? doc.pageCount : doc.visionPages.length);
    const hold = await deps.credits.reserve({ userId: cmd.userId, amount: credits, key: `analysis:${jobId}` });
    if (!hold.ok) {
      await deps.jobs.finish(jobId, "failed", hold.error.kind);
      return hold;
    }
    const holdId = hold.value.holdId;

    const fail = async (error: AppError): Promise<Result<never, AppError>> => {
      await deps.credits.release(holdId);
      await deps.jobs.finish(jobId, error.kind === "aborted" ? "aborted" : "failed", error.kind);
      await deps.documents.update(doc.id, { status: "failed" });
      logError("analysis.failed", { documentId: doc.id, kind: error.kind });
      return err(error);
    };

    // Text first: only scanned pages are transcribed, once, with the cheap profile.
    let pages = doc.pages;
    if (needsTranscription(doc)) {
      const file = await deps.files.read(doc.storagePath);
      if (!file.ok) return fail(file.error);
      const wanted = doc.pages === null ? range(doc.pageCount) : doc.visionPages;
      const transcribed = await deps.analyzer.transcribe({ file: file.value, pages: wanted, ctx });
      if (!transcribed.ok) return fail(transcribed.error);
      pages = mergeTranscription(doc.pages, doc.pageCount, doc.visionPages, transcribed.value);
      await deps.documents.update(doc.id, { pages, contentHash: await deps.hash(normalizeForHash(pages)) });
    }
    const text = pages ?? [];

    // A12: a cheap look first. A text that is not an official document asks before spending more.
    const mode = cmd.mode === "general" ? "general" : "full";
    if (mode === "full") {
      const kind = await deps.analyzer.classify({ text: text.join("\n"), ctx });
      if (kind.ok && !kind.value.official) {
        await deps.credits.release(holdId);
        await deps.jobs.finish(jobId, "done", "not_official");
        return ok({ kind: "not_official", language: kind.value.language });
      }
      if (!kind.ok && kind.error.kind !== "ai_failed") return fail(kind.error);
    }

    await deps.documents.update(doc.id, { status: "analyzing" });
    const startedAt = Date.now();
    const run = deps.analyzer.analyze({ pages: text, locale: cmd.locale, mode, ctx });

    const verify = async (startAt: number): Promise<Result<StoredAnalysis, AppError>> => {
      const attempt = startAt === 0 ? run : deps.analyzer.analyze({ pages: text, locale: cmd.locale, mode, ctx: { ...ctx, startAt } });
      const draft = await attempt.final.catch(() => err<AppError>({ kind: "ai_failed" }));
      if (!draft.ok) return draft;
      const tightened = toAnalysis(draft.value.draft);
      const claims = tightened.keyFacts.length + tightened.actions.length + tightened.watchOuts.length;
      const { analysis, dropped } = verifyCitations(tightened, text);
      // B08: everything dropped means the run is unusable. One retry on the next model.
      if (claims > 0 && dropped === claims) {
        if (startAt === 0) return verify(1);
        return err({ kind: "ai_failed" });
      }
      return ok({ documentId: doc.id, locale: cmd.locale, analysis, dropped, model: draft.value.usage.model });
    };

    const done = verify(0).then(async (verified): Promise<Result<StoredAnalysis, AppError>> => {
      if (!verified.ok) return fail(verified.error);
      const result = verified.value;
      const saved = await deps.analyses.save(cmd.userId, result);
      if (!saved.ok) return fail(saved.error);
      if (cacheKey) await deps.cache.put(cacheKey, { analysis: result.analysis, dropped: result.dropped, model: result.model });
      await deps.documents.update(doc.id, {
        status: "ready",
        kind: result.analysis.documentType,
        sourceLang: result.analysis.language,
      });
      await deps.onAnalyzed?.({ userId: cmd.userId, documentId: doc.id, result });
      await deps.credits.settle(holdId, credits);
      await deps.jobs.finish(jobId, "done");
      log("analysis.ready", { documentId: doc.id, dropped: result.dropped, ms: Date.now() - startedAt, model: result.model, credits });
      return ok(result);
    });

    return ok({ kind: "stream", credits, partials: run.partials, done });

    async function translate(source: StoredAnalysis): Promise<Result<AnalyzeOutcome, AppError>> {
      const admittedT = await deps.admission.admit({ userId: cmd.userId, action: "translate" });
      if (!admittedT.ok) return admittedT;
      const jobT = await deps.jobs.start({
        userId: cmd.userId,
        documentId: doc.id,
        kind: "translation",
        locale: cmd.locale,
        requestId: cmd.requestId,
      });
      if (!jobT.ok) return jobT;
      if (jobT.value === null) return ok({ kind: "running" });
      const tJob = jobT.value.id;
      const cost = await deps.translateCredits();
      const holdT = await deps.credits.reserve({ userId: cmd.userId, amount: cost, key: `translation:${tJob}` });
      if (!holdT.ok) {
        await deps.jobs.finish(tJob, "failed", holdT.error.kind);
        return holdT;
      }
      const translated = await deps.analyzer.translate({
        analysis: source.analysis,
        to: cmd.locale,
        ctx: { ...ctx, degraded: admittedT.value.degraded },
      });
      if (!translated.ok) {
        await deps.credits.release(holdT.value.holdId);
        await deps.jobs.finish(tJob, "failed", translated.error.kind);
        return translated;
      }
      const reused = await reuse(translated.value, source.dropped, source.model, "translated");
      if (!reused.ok) {
        await deps.credits.release(holdT.value.holdId);
        await deps.jobs.finish(tJob, "failed", reused.error.kind);
        return reused;
      }
      await deps.credits.settle(holdT.value.holdId, cost);
      await deps.jobs.finish(tJob, "done");
      return reused;
    }
  };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
