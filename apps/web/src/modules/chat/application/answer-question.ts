import type { AiAdmission, CreditPort } from "@/modules/analysis/application/ports";
import type { AnalysisRepository } from "@/modules/analysis/application/ports";
import type { OutputLocale } from "@/modules/analysis/domain/analysis";
import type { DocumentRepository } from "@/modules/documents/application/ports";
import type { AppError } from "@/shared/lib/errors";
import { log, logError } from "@/shared/lib/log";
import { err, ok, type Result } from "@/shared/lib/result";
import { type GroundedAnswer, groundAnswer, validateQuestion } from "../domain/grounding";
import {
  formatSummary,
  normalizeQuestion,
  parseSummary,
  planHistory,
  RETRIEVED_PAGES,
  WHOLE_DOCUMENT_MAX_CHARS,
} from "../domain/history";
import type { AnswerRun, ChatContext, ChatTurn, DocumentAnswerer, MessageRepository } from "./ports";

type Deps = {
  documents: DocumentRepository;
  analyses: AnalysisRepository;
  messages: MessageRepository;
  answerer: DocumentAnswerer;
  credits: CreditPort;
  admission: AiAdmission;
  /** Plan check for deep chat (S4 entitlements). */
  canUseDeepChat: (userId: string) => Promise<Result<null, AppError>>;
  creditsFor: (deep: boolean) => number;
  hash: (input: string) => Promise<string>;
};

export type AnswerOutcome =
  | { kind: "stored"; answer: GroundedAnswer }
  | { kind: "stream"; partials: AnswerRun["partials"]; done: Promise<Result<GroundedAnswer, AppError>> };

const HISTORY_LIMIT = 40;

/**
 * Answers from the document only. History comes from the database, never from the client.
 * Same question twice: stored answer, 0 credits. Long documents: summary plus matching pages.
 * Older turns collapse into a rolling summary. The final answer passes quote verification.
 */
export function makeAnswerQuestion(deps: Deps) {
  return async function answerQuestion(cmd: {
    userId: string;
    documentId: string;
    question: string;
    locale: OutputLocale;
    requestId: string;
    deep?: boolean;
    /** Regenerating the last answer: the question is already stored. */
    retry?: boolean;
    signal?: AbortSignal;
  }): Promise<Result<AnswerOutcome, AppError>> {
    const question = validateQuestion(cmd.question);
    if (!question) return err({ kind: "invalid_input", reason: "empty" });

    const docResult = await deps.documents.getOwned(cmd.userId, cmd.documentId);
    if (!docResult.ok) return docResult;
    const doc = docResult.value;
    const pages = doc.pages;
    if (!pages || doc.visionPages.length > 0) return err({ kind: "not_found" });

    const deep = cmd.deep === true;
    const questionHash = await deps.hash(`${doc.id}:${deep ? "deep" : "std"}:${normalizeQuestion(question)}`);

    // C09: the same question was answered before. Stored answer, 0 credits, no model call.
    if (!cmd.retry) {
      const previous = await deps.messages.findAnswer(doc.id, questionHash);
      if (previous) {
        const appended = await deps.messages.append(cmd.userId, doc.id, {
          role: "user",
          text: question,
          citations: [],
          refused: false,
        });
        if (!appended.ok) return appended;
        await deps.messages.append(cmd.userId, doc.id, {
          role: "assistant",
          text: previous.text,
          citations: previous.citations,
          refused: previous.refused,
          questionHash,
        });
        const answer: GroundedAnswer = previous.refused
          ? { kind: "refusal" }
          : { kind: "answer", text: previous.text, citations: previous.citations };
        log("chat.reused", { documentId: doc.id });
        return ok({ kind: "stored", answer });
      }
    }

    if (deep) {
      const allowed = await deps.canUseDeepChat(cmd.userId);
      if (!allowed.ok) return allowed;
    }
    const admitted = await deps.admission.admit({ userId: cmd.userId, action: deep ? "chat_deep" : "chat" });
    if (!admitted.ok) return admitted;

    const history = await deps.messages.list(doc.id, HISTORY_LIMIT);
    if (!history.ok) return history;

    const credits = deps.creditsFor(deep);
    const hold = await deps.credits.reserve({ userId: cmd.userId, amount: credits, key: `chat:${cmd.requestId}` });
    if (!hold.ok) return hold;
    const holdId = hold.value.holdId;
    const ctx = {
      requestId: cmd.requestId,
      userId: cmd.userId,
      documentId: doc.id,
      signal: cmd.signal,
      degraded: admitted.value.degraded,
    };

    const turns: ChatTurn[] = (cmd.retry ? history.value.slice(0, -1) : history.value).map((m) => ({
      role: m.role,
      text: m.refused ? "(not found in the document)" : m.text,
    }));

    // C08: older turns become a rolling summary (fast profile), refreshed every few turns.
    const stored = parseSummary(doc.chatSummary);
    const plan = planHistory(turns, stored);
    let summary = plan.older.length > 0 ? (stored?.text ?? null) : null;
    if (plan.needsRefresh) {
      const fresh = await deps.answerer.summarize({ turns: plan.older.slice(stored?.covered ?? 0), previous: stored?.text ?? null, ctx });
      if (fresh.ok) {
        summary = fresh.value;
        await deps.documents.update(doc.id, { chatSummary: formatSummary({ covered: plan.older.length, text: fresh.value }) });
      }
    }

    // C14: long documents use page retrieval so chat cost stays flat.
    const context = await chatContext(question);

    if (!cmd.retry) {
      const saved = await deps.messages.append(cmd.userId, doc.id, {
        role: "user",
        text: question,
        citations: [],
        refused: false,
      });
      if (!saved.ok) {
        await deps.credits.release(holdId);
        return saved;
      }
    }

    const run = deps.answerer.answer({
      context,
      history: plan.recent,
      historySummary: summary,
      question,
      locale: cmd.locale,
      deep,
      ctx,
    });

    const done = run.final
      .catch(() => err<AppError>({ kind: "ai_failed" }))
      .then(async (draft): Promise<Result<GroundedAnswer, AppError>> => {
        if (!draft.ok) {
          // C11: a stopped or failed answer is free.
          await deps.credits.release(holdId);
          logError("chat.failed", { documentId: doc.id, kind: draft.error.kind });
          return draft;
        }
        const grounded = groundAnswer(draft.value.draft, pages);
        await deps.messages.append(cmd.userId, doc.id, {
          role: "assistant",
          text: grounded.kind === "answer" ? grounded.text : "",
          citations: grounded.kind === "answer" ? grounded.citations : [],
          refused: grounded.kind === "refusal",
          questionHash,
        });
        await deps.credits.settle(holdId, credits);
        log("chat.answered", {
          documentId: doc.id,
          refused: grounded.kind === "refusal",
          citations: grounded.kind === "answer" ? grounded.citations.length : 0,
          retrieval: context.kind === "retrieved",
          cacheRead: draft.value.usage.cacheReadTokens,
        });
        return ok(grounded);
      });

    return ok({ kind: "stream", partials: run.partials, done });

    async function chatContext(q: string): Promise<ChatContext> {
      const size = pages?.reduce((n, p) => n + p.length, 0) ?? 0;
      if (size <= WHOLE_DOCUMENT_MAX_CHARS) return { kind: "whole", pages: pages ?? [] };
      const [hits, analysis] = await Promise.all([
        deps.documents.searchPages(doc.id, q, RETRIEVED_PAGES),
        deps.analyses.findAny(doc.id),
      ]);
      const found = hits.ok && hits.value.length > 0 ? hits.value : (pages ?? []).slice(0, 2).map((text, i) => ({ page: i + 1, text }));
      const docSummary = analysis.ok && analysis.value ? analysis.value.analysis.summary : "";
      return { kind: "retrieved", summary: docSummary, hits: found };
    }
  };
}
