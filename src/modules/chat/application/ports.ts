import type { Cite, OutputLocale } from "@/modules/analysis/domain/analysis";
import type { StoredFile } from "@/modules/documents/application/ports";
import type { AppError } from "@/shared/lib/errors";
import type { Result } from "@/shared/lib/result";
import type { ChatDraft } from "../domain/grounding";

export type ChatTurn = { role: "user" | "assistant"; text: string };

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
  final: Promise<Result<ChatDraft, AppError>>;
};

/** No tools, no network: it only reads the document it is given. */
export interface DocumentAnswerer {
  answer(input: {
    file: StoredFile;
    pages: readonly string[];
    history: readonly ChatTurn[];
    question: string;
    locale: OutputLocale;
  }): AnswerRun;
}

export interface MessageRepository {
  list(documentId: string, limit: number): Promise<Result<StoredMessage[], AppError>>;
  append(
    userId: string,
    documentId: string,
    message: { role: "user" | "assistant"; text: string; citations: Cite[]; refused: boolean },
  ): Promise<Result<null, AppError>>;
}
