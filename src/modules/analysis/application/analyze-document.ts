import type { DocumentRepository, FileStore } from "@/modules/documents/application/ports";
import type { QuotaService } from "@/modules/quota/application/ports";
import type { AppError } from "@/shared/lib/errors";
import { log, logError } from "@/shared/lib/log";
import { err, ok, type Result } from "@/shared/lib/result";
import { type OutputLocale, type PartialAnalysis, toAnalysis } from "../domain/analysis";
import { verifyCitations } from "../domain/verify-citations";
import type { AnalysisRepository, DocumentAnalyzer, StoredAnalysis } from "./ports";

export type AnalysisSink = {
  /** Called once a verified analysis is saved, e.g. to collect deadlines. */
  onAnalyzed?: (input: { userId: string; documentId: string; result: StoredAnalysis }) => Promise<void>;
};

type Deps = AnalysisSink & {
  documents: DocumentRepository;
  files: FileStore;
  analyses: AnalysisRepository;
  analyzer: DocumentAnalyzer;
  quota: QuotaService;
};

export type AnalyzeOutcome =
  | { kind: "cached"; result: StoredAnalysis }
  | {
      kind: "stream";
      partials: AsyncIterable<PartialAnalysis>;
      done: Promise<Result<StoredAnalysis, AppError>>;
    };

/**
 * One analysis per document per locale (cached). Otherwise: consume quota, read the file,
 * stream the model output, verify every quote against the page text, persist.
 * A failed run refunds the quota.
 */
export function makeAnalyzeDocument(deps: Deps) {
  return async function analyzeDocument(cmd: {
    userId: string;
    documentId: string;
    locale: OutputLocale;
  }): Promise<Result<AnalyzeOutcome, AppError>> {
    const cached = await deps.analyses.find(cmd.documentId, cmd.locale);
    if (!cached.ok) return cached;
    if (cached.value) return ok({ kind: "cached", result: cached.value });

    const doc = await deps.documents.getOwned(cmd.userId, cmd.documentId);
    if (!doc.ok) return doc;

    const allowed = await deps.quota.consume("analysis");
    if (!allowed.ok) return allowed;

    const fail = async (error: AppError): Promise<Result<never, AppError>> => {
      await deps.quota.refund("analysis");
      await deps.documents.update(cmd.documentId, { status: "failed" });
      logError("analysis.failed", { documentId: cmd.documentId, kind: error.kind });
      return err(error);
    };

    const file = await deps.files.read(doc.value.storagePath);
    if (!file.ok) return fail(file.error);

    let pages = doc.value.pages;
    if (pages === null) {
      const transcribed = await deps.analyzer.transcribe(file.value);
      if (!transcribed.ok) return fail(transcribed.error);
      pages = transcribed.value;
      await deps.documents.update(cmd.documentId, { pages });
    }
    const verifiedPages = pages;

    await deps.documents.update(cmd.documentId, { status: "analyzing" });
    const run = deps.analyzer.analyze({ file: file.value, pages: verifiedPages, locale: cmd.locale });
    const startedAt = Date.now();

    const finalDraft = run.final.catch(() => err<AppError>({ kind: "ai_failed" }));
    const done = finalDraft.then(async (draft): Promise<Result<StoredAnalysis, AppError>> => {
      if (!draft.ok) return fail(draft.error);
      const { analysis, dropped } = verifyCitations(toAnalysis(draft.value), verifiedPages);
      const result: StoredAnalysis = {
        documentId: cmd.documentId,
        locale: cmd.locale,
        analysis,
        dropped,
        model: deps.analyzer.model,
      };
      const saved = await deps.analyses.save(cmd.userId, result);
      if (!saved.ok) return fail(saved.error);
      await deps.documents.update(cmd.documentId, {
        status: "ready",
        kind: analysis.documentType,
        sourceLang: analysis.language,
      });
      await deps.onAnalyzed?.({ userId: cmd.userId, documentId: cmd.documentId, result });
      log("analysis.ready", {
        documentId: cmd.documentId,
        dropped,
        ms: Date.now() - startedAt,
        model: result.model,
      });
      return ok(result);
    });

    return ok({ kind: "stream", partials: run.partials, done });
  };
}
