import type { AiUsage } from "@/modules/ai/application/ports";
import type { AiContext } from "@/modules/analysis/application/ports";
import type { Cite, OutputLocale } from "@/modules/analysis/domain/analysis";
import type { PageHit } from "@/modules/documents/application/ports";
import type { AppError } from "@/shared/lib/errors";
import type { Result } from "@/shared/lib/result";
import type { ChatDraft } from "../domain/grounding";
import type { ChatTurn } from "../domain/history";

export type { ChatTurn };

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations: Cite[];
  refused: boolean;
  createdAt: string;
};

export type AnswerRun = {
  /** Partial, unverified answer text as it streams. */
  partials: AsyncIterable<{ answer?: string; found?: boolean }>;
  final: Promise<Result<{ draft: ChatDraft; usage: AiUsage }, AppError>>;
};

/** Small documents go whole (cached prefix); long ones as summary plus the best pages. */
export type ChatContext =
  | { kind: "whole"; pages: readonly string[] }
  | { kind: "retrieved"; summary: string; hits: readonly PageHit[] };

/** No tools, no network: it only reads the document context it is given. */
export interface DocumentAnswerer {
  answer(input: {
    context: ChatContext;
    history: readonly ChatTurn[];
    historySummary: string | null;
    question: string;
    locale: OutputLocale;
    deep: boolean;
    ctx: AiContext;
  }): AnswerRun;
  /** Rolling summary of older turns with the fast profile. */
  summarize(input: {
    turns: readonly ChatTurn[];
    previous: string | null;
    ctx: AiContext;
  }): Promise<Result<string, AppError>>;
}

export interface MessageRepository {
  list(documentId: string, limit: number): Promise<Result<StoredMessage[], AppError>>;
  append(
    userId: string,
    documentId: string,
    message: {
      role: "user" | "assistant";
      text: string;
      citations: Cite[];
      refused: boolean;
      questionHash?: string;
    },
  ): Promise<Result<null, AppError>>;
  /** The stored assistant answer to the same normalized question, if any. */
  findAnswer(documentId: string, questionHash: string): Promise<StoredMessage | null>;
}
