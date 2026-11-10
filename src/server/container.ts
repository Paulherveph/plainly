import "server-only";
import { makeAnalyzeDocument } from "@/modules/analysis/application/analyze-document";
import type { DocumentAnalyzer } from "@/modules/analysis/application/ports";
import { FakeAnalyzer } from "@/modules/analysis/infrastructure/fake-analyzer";
import { SupabaseAnalysisRepository } from "@/modules/analysis/infrastructure/supabase-analysis-repository";
import { makeAnswerQuestion } from "@/modules/chat/application/answer-question";
import type { DocumentAnswerer } from "@/modules/chat/application/ports";
import { FakeAnswerer } from "@/modules/chat/infrastructure/fake-answerer";
import { SupabaseMessageRepository } from "@/modules/chat/infrastructure/supabase-message-repository";
import {
  makeCollectDeadlines,
  makeExportDeadlines,
  makeListDeadlines,
  makeSetDeadlineDone,
} from "@/modules/deadlines/application/use-cases";
import { SupabaseDeadlineRepository } from "@/modules/deadlines/infrastructure/supabase-deadline-repository";
import { makeDeleteEverything } from "@/modules/documents/application/delete-everything";
import {
  makeGetDocument,
  makeGetOriginalUrl,
  makeListDocuments,
} from "@/modules/documents/application/queries";
import { makeUploadDocument } from "@/modules/documents/application/upload-document";
import { FsSampleLibrary } from "@/modules/documents/infrastructure/fs-sample-library";
import { SupabaseDocumentRepository } from "@/modules/documents/infrastructure/supabase-document-repository";
import { SupabaseFileStore } from "@/modules/documents/infrastructure/supabase-file-store";
import { UnpdfTextExtractor } from "@/modules/documents/infrastructure/unpdf-text-extractor";
import { SupabaseQuotaService } from "@/modules/quota/infrastructure/supabase-quota-service";
import { serverEnv } from "@/shared/config/env";
import { createSupabase, getSessionUser } from "./supabase";

let analyzer: Promise<DocumentAnalyzer> | undefined;
let answerer: Promise<DocumentAnswerer> | undefined;

/** The Anthropic SDK is only loaded when it is used (never with USE_FAKE_AI). */
function getAnalyzer(): Promise<DocumentAnalyzer> {
  analyzer ??= (async () => {
    const env = serverEnv();
    if (env.USE_FAKE_AI) return new FakeAnalyzer();
    const [{ createAnthropic }, { AnthropicAnalyzer }] = await Promise.all([
      import("@ai-sdk/anthropic"),
      import("@/modules/analysis/infrastructure/anthropic-analyzer"),
    ]);
    const provider = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return new AnthropicAnalyzer(provider, env.AI_MODEL_ANALYSIS, env.AI_MODEL_FAST);
  })();
  return analyzer;
}

function getAnswerer(): Promise<DocumentAnswerer> {
  answerer ??= (async () => {
    const env = serverEnv();
    if (env.USE_FAKE_AI) return new FakeAnswerer();
    const [{ createAnthropic }, { AnthropicAnswerer }] = await Promise.all([
      import("@ai-sdk/anthropic"),
      import("@/modules/chat/infrastructure/anthropic-answerer"),
    ]);
    return new AnthropicAnswerer(createAnthropic({ apiKey: env.ANTHROPIC_API_KEY }), env.AI_MODEL_ANALYSIS);
  })();
  return answerer;
}

/**
 * Composition root: wires adapters to ports for one request.
 * Every adapter uses the session-bound Supabase client, so RLS applies to all of it.
 */
export async function container() {
  const supabase = await createSupabase();
  const documents = new SupabaseDocumentRepository(supabase);
  const files = new SupabaseFileStore(supabase);
  const analyses = new SupabaseAnalysisRepository(supabase);
  const quota = new SupabaseQuotaService(supabase);
  const messages = new SupabaseMessageRepository(supabase);
  const deadlines = new SupabaseDeadlineRepository(supabase);

  return {
    currentUser: () => getSessionUser(supabase),
    quota,
    listDocuments: makeListDocuments({ documents }),
    getDocument: makeGetDocument({ documents }),
    getOriginalUrl: makeGetOriginalUrl({ documents, files }),
    uploadDocument: makeUploadDocument({
      documents,
      files,
      extractor: new UnpdfTextExtractor(),
      samples: new FsSampleLibrary(),
      newId: () => crypto.randomUUID(),
    }),
    analyzeDocument: makeAnalyzeDocument({
      documents,
      files,
      analyses,
      analyzer: await getAnalyzer(),
      quota,
      onAnalyzed: makeCollectDeadlines({ deadlines }),
    }),
    findAnalysis: analyses.find.bind(analyses),
    deleteEverything: makeDeleteEverything({ documents, files }),
    answerQuestion: makeAnswerQuestion({ documents, files, messages, answerer: await getAnswerer(), quota }),
    listMessages: messages.list.bind(messages),
    listDeadlines: makeListDeadlines({ deadlines }),
    setDeadlineDone: makeSetDeadlineDone({ deadlines }),
    exportDeadlines: makeExportDeadlines({ deadlines, now: () => new Date() }),
  };
}

export type Container = Awaited<ReturnType<typeof container>>;
