import "server-only";
import type { TierReader } from "@/modules/ai/application/admission";
import { makeAnalyzeDocument } from "@/modules/analysis/application/analyze-document";
import { GatewayAnalyzer } from "@/modules/analysis/infrastructure/gateway-analyzer";
import { SupabaseAnalysisCache } from "@/modules/analysis/infrastructure/supabase-analysis-cache";
import { SupabaseAnalysisRepository } from "@/modules/analysis/infrastructure/supabase-analysis-repository";
import { SupabaseJobStore } from "@/modules/analysis/infrastructure/supabase-job-store";
import { makeAnswerQuestion } from "@/modules/chat/application/answer-question";
import { GatewayAnswerer } from "@/modules/chat/infrastructure/gateway-answerer";
import { SupabaseMessageRepository } from "@/modules/chat/infrastructure/supabase-message-repository";
import {
  makeAddDeadlineFromAction,
  makeCollectDeadlines,
  makeExportDeadlines,
  makeListDeadlines,
  makeSetDeadlineDone,
} from "@/modules/deadlines/application/use-cases";
import { SupabaseDeadlineRepository } from "@/modules/deadlines/infrastructure/supabase-deadline-repository";
import { makeDeleteDocument } from "@/modules/documents/application/delete-document";
import { makeDeleteEverything } from "@/modules/documents/application/delete-everything";
import { makeGetDocument, makeListDocuments, makeReadOriginal } from "@/modules/documents/application/queries";
import { makeUploadDocument } from "@/modules/documents/application/upload-document";
import { FsSampleLibrary } from "@/modules/documents/infrastructure/fs-sample-library";
import { SupabaseDocumentRepository } from "@/modules/documents/infrastructure/supabase-document-repository";
import { SupabaseFileStore } from "@/modules/documents/infrastructure/supabase-file-store";
import { UnpdfTextExtractor } from "@/modules/documents/infrastructure/unpdf-text-extractor";
import { QuotaCreditPort } from "@/modules/quota/infrastructure/quota-credit-port";
import { SupabaseQuotaService } from "@/modules/quota/infrastructure/supabase-quota-service";
import { sha256Hex, webHasher } from "@/shared/lib/hash";
import { ok } from "@/shared/lib/result";
import { admission, aiGateway, profileVersion } from "./ai";
import { createSupabase, getSessionUser } from "./supabase";

const CREDITS = { chat: 1, chatDeep: 3, translate: 1 } as const;

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
  const samples = new FsSampleLibrary();
  const ai = aiGateway(supabase);
  const credits = new QuotaCreditPort(quota);
  const currentUser = () => getSessionUser(supabase);

  const tiers: TierReader = {
    tier: async () => {
      const user = await currentUser();
      return { tier: user?.isAnonymous === false ? "free" : "guest", maxConcurrentAnalyses: 1 };
    },
  };
  const gate = admission(supabase, tiers);

  return {
    currentUser,
    quota,
    listDocuments: makeListDocuments({ documents }),
    getDocument: makeGetDocument({ documents }),
    readOriginal: makeReadOriginal({ documents, files }),
    uploadDocument: makeUploadDocument({
      documents,
      files,
      extractor: new UnpdfTextExtractor(),
      samples,
      hasher: webHasher,
      newId: () => crypto.randomUUID(),
    }),
    analyzeDocument: makeAnalyzeDocument({
      documents,
      files,
      analyses,
      analyzer: new GatewayAnalyzer(ai),
      cache: new SupabaseAnalysisCache(supabase),
      samples,
      jobs: new SupabaseJobStore(supabase),
      credits,
      admission: gate,
      profileVersion: profileVersion(),
      translateCredits: CREDITS.translate,
      hash: sha256Hex,
      onAnalyzed: makeCollectDeadlines({ deadlines }),
    }),
    findAnalysis: analyses.find.bind(analyses),
    deleteDocument: makeDeleteDocument({ documents, files }),
    deleteEverything: makeDeleteEverything({ documents, files }),
    answerQuestion: makeAnswerQuestion({
      documents,
      analyses,
      messages,
      answerer: new GatewayAnswerer(ai),
      credits,
      admission: gate,
      canUseDeepChat: async () => ok(null),
      creditsFor: (deep) => (deep ? CREDITS.chatDeep : CREDITS.chat),
      hash: sha256Hex,
    }),
    listMessages: messages.list.bind(messages),
    listDeadlines: makeListDeadlines({ deadlines }),
    setDeadlineDone: makeSetDeadlineDone({ deadlines }),
    addDeadlineFromAction: makeAddDeadlineFromAction({ deadlines, findAnalysis: analyses.find.bind(analyses) }),
    exportDeadlines: makeExportDeadlines({ deadlines, now: () => new Date() }),
  };
}

export type Container = Awaited<ReturnType<typeof container>>;
