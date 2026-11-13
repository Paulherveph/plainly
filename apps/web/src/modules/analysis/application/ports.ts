import type { StoredFile } from "@/modules/documents/application/ports";
import type { AppError } from "@/shared/lib/errors";
import type { Result } from "@/shared/lib/result";
import type { Analysis, AnalysisDraft, OutputLocale, PartialAnalysis } from "../domain/analysis";

export type AnalysisRun = {
  /** Unverified partial output, for progressive rendering only. */
  partials: AsyncIterable<PartialAnalysis>;
  final: Promise<Result<AnalysisDraft, AppError>>;
};

export interface DocumentAnalyzer {
  readonly model: string;
  analyze(input: { file: StoredFile; pages: string[] | null; locale: OutputLocale }): AnalysisRun;
  /** For images (no text layer): verbatim text per page, used only to verify quotes. */
  transcribe(file: StoredFile): Promise<Result<string[], AppError>>;
}

export type StoredAnalysis = {
  documentId: string;
  locale: OutputLocale;
  analysis: Analysis;
  dropped: number;
  model: string;
};

export interface AnalysisRepository {
  find(documentId: string, locale: OutputLocale): Promise<Result<StoredAnalysis | null, AppError>>;
  save(userId: string, analysis: StoredAnalysis): Promise<Result<null, AppError>>;
}
