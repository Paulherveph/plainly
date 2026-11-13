import "server-only";
import { z } from "zod";
import type { AiCall, AiGateway } from "@/modules/ai/application/ports";
import { toAppError } from "@/modules/ai/domain/errors";
import type { StoredFile } from "@/modules/documents/application/ports";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { AiContext, AnalysisRun, Classification, DocumentAnalyzer } from "../application/ports";
import { type Analysis, AnalysisDraft, type OutputLocale, type PartialAnalysis } from "../domain/analysis";
import { restoreQuotes, stripQuotes, Translatable } from "../domain/translate";
import {
  ANALYSIS_INSTRUCTIONS,
  analysisRequest,
  CLASSIFY_INSTRUCTIONS,
  documentText,
  generalRequest,
  LANGUAGE_NAMES,
  TRANSCRIBE_INSTRUCTIONS,
  TRANSLATE_INSTRUCTIONS,
  wrapDocumentText,
} from "./prompts";

const ClassifySchema = z.object({
  official: z.boolean(),
  language: z.enum(["en", "fr", "zh", "other"]),
});
const TranscriptSchema = z.object({
  pages: z.array(z.object({ page: z.number().int().positive(), text: z.string() })),
});

/** Input caps per call (characters). Rejected before any provider call. */
const MAX_INPUT = { analysis: 420_000, classify: 4_000, transcribe: 4_000, translate: 40_000 } as const;

const base = (ctx: AiContext): Pick<AiCall, "requestId" | "userId" | "documentId" | "signal" | "degraded"> => ({
  requestId: ctx.requestId,
  userId: ctx.userId,
  documentId: ctx.documentId,
  signal: ctx.signal,
  degraded: ctx.degraded,
});

/** Analysis through the AI gateway: text first, compact schema, output caps. */
export class GatewayAnalyzer implements DocumentAnalyzer {
  constructor(private readonly ai: AiGateway) {}

  async classify(input: { text: string; ctx: AiContext }): Promise<Result<Classification, AppError>> {
    const res = await this.ai.generateObject({
      ...base(input.ctx),
      profile: "fast",
      task: "classify",
      schema: ClassifySchema,
      system: CLASSIFY_INSTRUCTIONS,
      messages: [{ role: "user", content: wrapDocumentText(input.text.slice(0, 1500)) }],
      maxOutputTokens: 40,
      maxInputChars: MAX_INPUT.classify,
    });
    return res.ok ? ok(res.value.value) : err(toAppError(res.error));
  }

  analyze(input: {
    pages: readonly string[];
    locale: OutputLocale;
    mode: "full" | "general";
    ctx: AiContext;
  }): AnalysisRun {
    const run = this.ai.streamObject({
      ...base(input.ctx),
      profile: input.mode === "general" ? "fast" : "analysis",
      task: "analyze",
      schema: AnalysisDraft,
      system: ANALYSIS_INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: documentText(input.pages) },
            {
              type: "text",
              text: input.mode === "general" ? generalRequest(input.locale) : analysisRequest(input.locale),
            },
          ],
        },
      ],
      maxOutputTokens: input.mode === "general" ? 2_500 : 6_000,
      maxInputChars: MAX_INPUT.analysis,
      ...(input.ctx.startAt ? { startAt: input.ctx.startAt } : {}),
    });
    const final = run.final.then((res) =>
      res.ok ? ok({ draft: res.value.value, usage: res.value.usage }) : err(toAppError(res.error)),
    );
    return { partials: run.partials as AsyncIterable<PartialAnalysis>, final };
  }

  async transcribe(input: {
    file: StoredFile;
    pages: readonly number[];
    ctx: AiContext;
  }): Promise<Result<Map<number, string>, AppError>> {
    const res = await this.ai.generateObject({
      ...base(input.ctx),
      profile: "fast",
      task: "transcribe",
      schema: TranscriptSchema,
      system: TRANSCRIBE_INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: [
            { type: "file", mediaType: input.file.mediaType, data: input.file.bytes },
            { type: "text", text: `Transcribe these pages: ${input.pages.join(", ")}.` },
          ],
        },
      ],
      maxOutputTokens: Math.min(16_000, 1_500 * input.pages.length),
      maxInputChars: MAX_INPUT.transcribe,
    });
    if (!res.ok) return err(toAppError(res.error));
    const wanted = new Set(input.pages);
    const out = new Map<number, string>();
    for (const p of res.value.value.pages) if (wanted.has(p.page)) out.set(p.page, p.text);
    const hasText = [...out.values()].some((t) => t.trim().length > 0);
    return hasText ? ok(out) : err({ kind: "invalid_input", reason: "unreadable" });
  }

  async translate(input: { analysis: Analysis; to: OutputLocale; ctx: AiContext }): Promise<Result<Analysis, AppError>> {
    const res = await this.ai.generateObject({
      ...base(input.ctx),
      profile: "translate",
      task: "translate",
      schema: Translatable,
      system: TRANSLATE_INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: `Translate into ${LANGUAGE_NAMES[input.to]}:\n${JSON.stringify(stripQuotes(input.analysis))}`,
        },
      ],
      maxOutputTokens: 3_000,
      maxInputChars: MAX_INPUT.translate,
    });
    if (!res.ok) return err(toAppError(res.error));
    const restored = restoreQuotes(input.analysis, res.value.value);
    return restored ? ok(restored) : err({ kind: "ai_failed" });
  }
}
