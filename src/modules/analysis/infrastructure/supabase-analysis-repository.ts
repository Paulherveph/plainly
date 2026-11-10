import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/shared/lib/db-types";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { AnalysisRepository, StoredAnalysis } from "../application/ports";
import { Analysis, type OutputLocale } from "../domain/analysis";

export class SupabaseAnalysisRepository implements AnalysisRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async find(documentId: string, locale: OutputLocale): Promise<Result<StoredAnalysis | null, AppError>> {
    const { data, error } = await this.db
      .from("analyses")
      .select("result, model, dropped_claims")
      .eq("document_id", documentId)
      .eq("locale", locale)
      .maybeSingle();
    if (error) return err({ kind: "db_failed" });
    if (!data) return ok(null);
    const analysis = Analysis.safeParse(data.result);
    if (!analysis.success) return ok(null); // stale shape: treat as missing and re-run
    return ok({
      documentId,
      locale,
      analysis: analysis.data,
      dropped: data.dropped_claims,
      model: data.model,
    });
  }

  async save(userId: string, a: StoredAnalysis): Promise<Result<null, AppError>> {
    const { error } = await this.db.from("analyses").upsert(
      {
        document_id: a.documentId,
        user_id: userId,
        locale: a.locale,
        result: a.analysis as unknown as Json,
        model: a.model,
        dropped_claims: a.dropped,
      },
      { onConflict: "document_id,locale" },
    );
    return error ? err({ kind: "db_failed" }) : ok(null);
  }
}
