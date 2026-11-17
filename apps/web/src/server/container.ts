import "server-only";
import {
  makeDeleteAccount,
  makeExportData,
  makeUpdateProfile,
} from "@/modules/accounts/application/use-cases";
import { fflateZipper } from "@/modules/accounts/infrastructure/fflate-zipper";
import { SupabaseAccountAdmin } from "@/modules/accounts/infrastructure/supabase-account-admin";
import { SupabaseAccountData } from "@/modules/accounts/infrastructure/supabase-account-data";
import { SupabaseActivityReader } from "@/modules/accounts/infrastructure/supabase-activity";
import { SupabaseProfileRepository } from "@/modules/accounts/infrastructure/supabase-profile-repository";
import type { TierReader } from "@/modules/ai/application/admission";
import { makeAnalyzeDocument } from "@/modules/analysis/application/analyze-document";
import { GatewayAnalyzer } from "@/modules/analysis/infrastructure/gateway-analyzer";
import { SupabaseAnalysisCache } from "@/modules/analysis/infrastructure/supabase-analysis-cache";
import { SupabaseAnalysisRepository } from "@/modules/analysis/infrastructure/supabase-analysis-repository";
import { SupabaseJobStore } from "@/modules/analysis/infrastructure/supabase-job-store";
import {
  makeCancelForDeletion,
  makeLatestReceipt,
  makeStartCheckout,
} from "@/modules/billing/application/billing";
import { makeEntitlements } from "@/modules/billing/application/entitlement-service";
import { CREDIT_COSTS } from "@/modules/billing/domain/credits.config";
import { renderReceiptPdf } from "@/modules/billing/infrastructure/pdf-receipt";
import { SupabaseCreditStore } from "@/modules/billing/infrastructure/supabase-credit-store";
import { SupabasePlanRepository } from "@/modules/billing/infrastructure/supabase-plan-repository";
import { SupabasePurchaseReader } from "@/modules/billing/infrastructure/supabase-purchase-reader";
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
import {
  makeGetDocument,
  makeListDocuments,
  makeReadOriginal,
} from "@/modules/documents/application/queries";
import { makeUploadDocument } from "@/modules/documents/application/upload-document";
import { FsSampleLibrary } from "@/modules/documents/infrastructure/fs-sample-library";
import { SupabaseDocumentRepository } from "@/modules/documents/infrastructure/supabase-document-repository";
import { SupabaseFileStore } from "@/modules/documents/infrastructure/supabase-file-store";
import { UnpdfTextExtractor } from "@/modules/documents/infrastructure/unpdf-text-extractor";
import { serverEnv } from "@/shared/config/env";
import { sha256Hex, webHasher } from "@/shared/lib/hash";
import { ok } from "@/shared/lib/result";
import { admission, aiGateway, profileVersion } from "./ai";
import { billingProvider, billingStore } from "./billing";
import { ResendMailer } from "./resend-mailer";
import { createSupabase, getSessionUser } from "./supabase";
import { createSupabaseAdmin } from "./supabase-admin";

/**
 * Composition root: wires adapters to ports for one request.
 * Every adapter uses the session-bound Supabase client, so RLS applies to all of it.
 */
export async function container() {
  const supabase = await createSupabase();
  const documents = new SupabaseDocumentRepository(supabase);
  const files = new SupabaseFileStore(supabase);
  const analyses = new SupabaseAnalysisRepository(supabase);
  const messages = new SupabaseMessageRepository(supabase);
  const deadlines = new SupabaseDeadlineRepository(supabase);
  const samples = new FsSampleLibrary();
  const ai = aiGateway(supabase);
  const currentUser = () => getSessionUser(supabase);
  const plans = new SupabasePlanRepository(supabase);
  const creditStore = new SupabaseCreditStore(supabase);
  const entitlements = makeEntitlements({ plans, credits: creditStore });
  const credits = entitlements.credits;
  const tiers: TierReader = entitlements.tiers;
  const gate = admission(supabase, tiers);
  const provider = billingProvider();
  const store = billingStore();
  const profiles = new SupabaseProfileRepository(supabase);
  const env = serverEnv();
  const mailer =
    env.RESEND_API_KEY && env.EMAIL_FROM ? new ResendMailer(env.RESEND_API_KEY, env.EMAIL_FROM) : null;
  const adminClient = createSupabaseAdmin();
  const accountAdmin = adminClient
    ? new SupabaseAccountAdmin(adminClient, new SupabaseFileStore(adminClient))
    : null;

  return {
    currentUser,
    entitlements,
    plans: plans.listPlans.bind(plans),
    ledger: creditStore.ledger.bind(creditStore),
    markLowNudged: creditStore.markLowNudged.bind(creditStore),
    startCheckout: makeStartCheckout({ provider, plans }),
    latestReceipt: makeLatestReceipt({
      purchases: new SupabasePurchaseReader(supabase),
      plans,
      demo: provider.name === "fake",
    }),
    /** Writes a receipt as a one-page PDF (no dependency). */
    receiptPdf: renderReceiptPdf,
    openPortal: provider.createPortalSession.bind(provider),
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
      checkLimits: ({ pages, bytes }) => entitlements.uploadLimits({ pages, bytes }),
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
      translateCredits: entitlements.translateCredits,
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
      canUseDeepChat: entitlements.canUseDeepChat,
      creditsFor: (deep) => (deep ? CREDIT_COSTS.chatDeep : CREDIT_COSTS.chat),
      hash: sha256Hex,
    }),
    listMessages: messages.list.bind(messages),
    listDeadlines: makeListDeadlines({ deadlines }),
    setDeadlineDone: makeSetDeadlineDone({ deadlines }),
    addDeadlineFromAction: makeAddDeadlineFromAction({
      deadlines,
      findAnalysis: analyses.find.bind(analyses),
    }),
    exportDeadlines: makeExportDeadlines({ deadlines, now: () => new Date() }),
    getProfile: profiles.get.bind(profiles),
    /** Documents explained and questions asked per day, last year (account activity graph). */
    activity: () => new SupabaseActivityReader(supabase).lastYear(),
    /** Linked sign-in methods for the Security tab (no tokens, provider names only). */
    identities: async (): Promise<string[]> => {
      const { data } = await supabase.auth.getUserIdentities();
      return (data?.identities ?? []).map((i) => i.provider).filter((p) => p !== "anonymous");
    },
    updateProfile: makeUpdateProfile({ profiles }),
    exportData: makeExportData({
      data: new SupabaseAccountData(supabase, files, ["credit_ledger", "subscriptions"]),
      zipper: fflateZipper,
    }),
    /** Null when the service key is missing: account deletion needs it. */
    deleteAccount: accountAdmin
      ? makeDeleteAccount({
          admin: accountAdmin,
          subscriptions: {
            cancelForDeletion: store ? makeCancelForDeletion({ provider, store }) : async () => ok(null),
          },
          mailer,
        })
      : null,
  };
}

export type Container = Awaited<ReturnType<typeof container>>;
