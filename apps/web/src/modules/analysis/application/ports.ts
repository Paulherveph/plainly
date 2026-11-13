import type { AiUsage } from "@/modules/ai/application/ports";
import type { SampleId, StoredFile } from "@/modules/documents/application/ports";
import type { AppError } from "@/shared/lib/errors";
import type { Result } from "@/shared/lib/result";
import type { Analysis, AnalysisDraft, OutputLocale, PartialAnalysis } from "../domain/analysis";

/** Who pays and how to cancel. Every AI call carries it for metering. */
export type AiContext = {
  requestId: string;
  userId: string;
  documentId: string;
  signal?: AbortSignal;
  /** Budget guard at 80%: cheaper model variant. */
  degraded?: boolean;
  /** Skip the first n models of the profile (retry on the next model). */
  startAt?: number;
};

export type AnalysisRun = {
  /** Unverified partial output, for progressive rendering only. */
  partials: AsyncIterable<PartialAnalysis>;
  final: Promise<Result<{ draft: AnalysisDraft; usage: AiUsage }, AppError>>;
};

export type Classification = { official: boolean; language: "en" | "fr" | "zh" | "other" };

export interface DocumentAnalyzer {
  /** Cheap check on the first 1.5k characters with the `fast` profile. */
  classify(input: { text: string; ctx: AiContext }): Promise<Result<Classification, AppError>>;
  /** Text only. `general` uses the cheap profile (A12: not an official document). */
  analyze(input: { pages: readonly string[]; locale: OutputLocale; mode: "full" | "general"; ctx: AiContext }): AnalysisRun;
  /** Scanned pages only: verbatim text per requested page. */
  transcribe(input: {
    file: StoredFile;
    pages: readonly number[];
    ctx: AiContext;
  }): Promise<Result<Map<number, string>, AppError>>;
  /** New locale from an existing analysis (translate profile). Quotes never change. */
  translate(input: { analysis: Analysis; to: OutputLocale; ctx: AiContext }): Promise<Result<Analysis, AppError>>;
}

export type StoredAnalysis = {
  documentId: string;
  locale: OutputLocale;
  analysis: Analysis;
  dropped: number;
  model: string;
  /** Prompt and schema version that produced it (B20). Missing on rows saved before versions. */
  version?: string;
};

export interface AnalysisRepository {
  find(documentId: string, locale: OutputLocale): Promise<Result<StoredAnalysis | null, AppError>>;
  /** Any locale already analyzed for this document (source for a translation). */
  findAny(documentId: string): Promise<Result<StoredAnalysis | null, AppError>>;
  save(userId: string, analysis: StoredAnalysis): Promise<Result<null, AppError>>;
}

/** Same content, locale and versions: reuse the result for 0 credits (A16). */
export interface AnalysisCache {
  get(key: string): Promise<{ analysis: Analysis; dropped: number; model: string } | null>;
  put(key: string, value: { analysis: Analysis; dropped: number; model: string }): Promise<void>;
}

export interface SampleAnalyses {
  analysis(id: SampleId, locale: OutputLocale): Promise<Analysis | null>;
}

export type JobKind = "analysis" | "translation";

export interface JobStore {
  /** Null when the same work is already running (no double charge, no double spend). */
  start(input: {
    userId: string;
    documentId: string;
    kind: JobKind;
    locale: OutputLocale;
    requestId: string;
  }): Promise<Result<{ id: string } | null, AppError>>;
  finish(id: string, status: "done" | "failed" | "aborted", errorKind?: string): Promise<void>;
}

/** Credits: reserve before the call, settle on success, release on failure (S4 implements it). */
export interface CreditPort {
  reserve(input: { userId: string; amount: number; key: string }): Promise<Result<{ holdId: string | null }, AppError>>;
  settle(holdId: string | null, amount: number): Promise<void>;
  release(holdId: string | null): Promise<void>;
}

/** Budget, per-user rate and concurrency limits, checked before any model call. */
export interface AiAdmission {
  admit(input: { userId: string; action: "analysis" | "chat" | "chat_deep" | "translate" }): Promise<
    Result<{ degraded: boolean }, AppError>
  >;
}
