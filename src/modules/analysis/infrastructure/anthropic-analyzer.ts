import "server-only";
import type { AnthropicProvider } from "@ai-sdk/anthropic";
import { generateText, type ModelMessage, Output, streamText } from "ai";
import type { StoredFile } from "@/modules/documents/application/ports";
import type { AppError } from "@/shared/lib/errors";
import { logError } from "@/shared/lib/log";
import { err, ok, type Result } from "@/shared/lib/result";
import type { AnalysisRun, DocumentAnalyzer } from "../application/ports";
import { AnalysisDraft, type OutputLocale, type PartialAnalysis } from "../domain/analysis";
import { ANALYSIS_INSTRUCTIONS, analysisRequest, TRANSCRIBE_INSTRUCTIONS, wrapDocumentText } from "./prompts";

/**
 * Claude reads the original file natively (PDF or image); pasted text goes in delimiters.
 * Output is structured (Zod) and streamed. Quotes are verified later by the use case.
 */
export class AnthropicAnalyzer implements DocumentAnalyzer {
  constructor(
    private readonly anthropic: AnthropicProvider,
    readonly model: string,
    private readonly fastModel: string,
  ) {}

  analyze(input: { file: StoredFile; pages: string[] | null; locale: OutputLocale }): AnalysisRun {
    const result = streamText({
      model: this.anthropic(this.model),
      instructions: ANALYSIS_INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: [documentPart(input.file), { type: "text", text: analysisRequest(input.locale) }],
        },
      ],
      output: Output.object({ schema: AnalysisDraft }),
      maxOutputTokens: 16_000,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(120_000),
      onError: ({ error }) => logError("anthropic.analyze.stream_error", { name: errorName(error) }),
    });

    const final = Promise.resolve(result.output).then(
      (output): Result<AnalysisDraft, AppError> => {
        const parsed = AnalysisDraft.safeParse(output);
        return parsed.success ? ok(parsed.data) : err({ kind: "ai_failed" });
      },
      (error: unknown): Result<AnalysisDraft, AppError> => {
        logError("anthropic.analyze.failed", { name: errorName(error) });
        return err({ kind: "ai_failed" });
      },
    );
    return { partials: result.partialOutputStream as AsyncIterable<PartialAnalysis>, final };
  }

  async transcribe(file: StoredFile): Promise<Result<string[], AppError>> {
    try {
      const { text } = await generateText({
        model: this.anthropic(this.fastModel),
        instructions: TRANSCRIBE_INSTRUCTIONS,
        messages: [{ role: "user", content: [documentPart(file)] }],
        maxOutputTokens: 8_000,
        abortSignal: AbortSignal.timeout(60_000),
      });
      return text.trim().length > 0 ? ok([text]) : err({ kind: "invalid_input", reason: "unreadable" });
    } catch (error) {
      logError("anthropic.transcribe.failed", { name: errorName(error) });
      return err({ kind: "ai_failed" });
    }
  }
}

type UserContent = Exclude<Extract<ModelMessage, { role: "user" }>["content"], string>[number];

export function documentPart(file: StoredFile): UserContent {
  if (file.mediaType === "text/plain")
    return { type: "text", text: wrapDocumentText(new TextDecoder().decode(file.bytes)) };
  return { type: "file", mediaType: file.mediaType, data: file.bytes };
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}
