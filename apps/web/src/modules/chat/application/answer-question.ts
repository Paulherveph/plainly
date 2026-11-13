import type { OutputLocale } from "@/modules/analysis/domain/analysis";
import type { DocumentRepository, FileStore } from "@/modules/documents/application/ports";
import type { QuotaService } from "@/modules/quota/application/ports";
import type { AppError } from "@/shared/lib/errors";
import { log, logError } from "@/shared/lib/log";
import { err, ok, type Result } from "@/shared/lib/result";
import { type GroundedAnswer, groundAnswer, HISTORY_TURNS, validateQuestion } from "../domain/grounding";
import type { AnswerRun, DocumentAnswerer, MessageRepository } from "./ports";

type Deps = {
  documents: DocumentRepository;
  files: FileStore;
  messages: MessageRepository;
  answerer: DocumentAnswerer;
  quota: QuotaService;
};

export type AnswerOutcome = {
  partials: AnswerRun["partials"];
  done: Promise<Result<GroundedAnswer, AppError>>;
};

/**
 * Answers from the document only. History comes from the database, never from the client.
 * The final answer passes the same quote verification as the analysis, or becomes a refusal.
 */
export function makeAnswerQuestion(deps: Deps) {
  return async function answerQuestion(cmd: {
    userId: string;
    documentId: string;
    question: string;
    locale: OutputLocale;
    /** Regenerating the last answer: the question is already stored. */
    retry?: boolean;
  }): Promise<Result<AnswerOutcome, AppError>> {
    const question = validateQuestion(cmd.question);
    if (!question) return err({ kind: "invalid_input", reason: "empty" });

    const doc = await deps.documents.getOwned(cmd.userId, cmd.documentId);
    if (!doc.ok) return doc;
    const pages = doc.value.pages;
    if (!pages) return err({ kind: "not_found" });

    const allowed = await deps.quota.consume("chat");
    if (!allowed.ok) return allowed;

    const [file, history] = await Promise.all([
      deps.files.read(doc.value.storagePath),
      deps.messages.list(cmd.documentId, HISTORY_TURNS),
    ]);
    if (!file.ok || !history.ok) {
      await deps.quota.refund("chat");
      return err({ kind: file.ok ? "db_failed" : "storage_failed" });
    }

    const saved = cmd.retry
      ? ok(null)
      : await deps.messages.append(cmd.userId, cmd.documentId, {
          role: "user",
          text: question,
          citations: [],
          refused: false,
        });
    if (!saved.ok) {
      await deps.quota.refund("chat");
      return saved;
    }

    const run = deps.answerer.answer({
      file: file.value,
      pages,
      history: (cmd.retry ? history.value.slice(0, -1) : history.value).map((m) => ({
        role: m.role,
        text: m.refused ? "(not found in the document)" : m.text,
      })),
      question,
      locale: cmd.locale,
    });

    const done = run.final
      .catch(() => err<AppError>({ kind: "ai_failed" }))
      .then(async (draft): Promise<Result<GroundedAnswer, AppError>> => {
        if (!draft.ok) {
          await deps.quota.refund("chat");
          logError("chat.failed", { documentId: cmd.documentId, kind: draft.error.kind });
          return draft;
        }
        const grounded = groundAnswer(draft.value, pages);
        await deps.messages.append(cmd.userId, cmd.documentId, {
          role: "assistant",
          text: grounded.kind === "answer" ? grounded.text : "",
          citations: grounded.kind === "answer" ? grounded.citations : [],
          refused: grounded.kind === "refusal",
        });
        log("chat.answered", {
          documentId: cmd.documentId,
          refused: grounded.kind === "refusal",
          citations: grounded.kind === "answer" ? grounded.citations.length : 0,
        });
        return ok(grounded);
      });

    return ok({ partials: run.partials, done });
  };
}
