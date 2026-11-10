import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/shared/lib/db-types";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { DocumentPatch, DocumentRepository, NewDocument } from "../application/ports";
import {
  DOCUMENT_STATUSES,
  type Document,
  type DocumentSummary,
  joinPages,
  MEDIA_TYPES,
  splitPages,
} from "../domain/document";

const SUMMARY_COLUMNS = "id, title, kind, status, page_count, created_at, expires_at";
const FULL_COLUMNS = `${SUMMARY_COLUMNS}, user_id, media_type, storage_path, source_lang, extracted_text`;

const SummaryRow = z.object({
  id: z.uuid(),
  title: z.string(),
  kind: z.string().nullable(),
  status: z.enum(DOCUMENT_STATUSES),
  page_count: z.number().int(),
  created_at: z.string(),
  expires_at: z.string(),
});
const FullRow = SummaryRow.extend({
  user_id: z.uuid(),
  media_type: z.enum(MEDIA_TYPES),
  storage_path: z.string(),
  source_lang: z.string().nullable(),
  extracted_text: z.string().nullable(),
});

function toSummary(row: z.infer<typeof SummaryRow>): DocumentSummary {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    pageCount: row.page_count,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function toDocument(row: z.infer<typeof FullRow>): Document {
  return {
    ...toSummary(row),
    userId: row.user_id,
    mediaType: row.media_type,
    storagePath: row.storage_path,
    sourceLang: row.source_lang,
    pages: splitPages(row.extracted_text),
  };
}

export class SupabaseDocumentRepository implements DocumentRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(doc: NewDocument): Promise<Result<Document, AppError>> {
    const { data, error } = await this.db
      .from("documents")
      .insert({
        id: doc.id,
        user_id: doc.userId,
        title: doc.title,
        media_type: doc.mediaType,
        storage_path: doc.storagePath,
        page_count: doc.pageCount,
        extracted_text: doc.pages ? joinPages(doc.pages) : null,
      })
      .select(FULL_COLUMNS)
      .single();
    if (error) return err({ kind: "db_failed" });
    const row = FullRow.safeParse(data);
    return row.success ? ok(toDocument(row.data)) : err({ kind: "db_failed" });
  }

  async getOwned(userId: string, id: string): Promise<Result<Document, AppError>> {
    if (!z.uuid().safeParse(id).success) return err({ kind: "not_found" });
    const { data, error } = await this.db
      .from("documents")
      .select(FULL_COLUMNS)
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return err({ kind: "db_failed" });
    if (!data) return err({ kind: "not_found" });
    const row = FullRow.safeParse(data);
    return row.success ? ok(toDocument(row.data)) : err({ kind: "db_failed" });
  }

  async listOwned(userId: string): Promise<Result<DocumentSummary[], AppError>> {
    const { data, error } = await this.db
      .from("documents")
      .select(SUMMARY_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return err({ kind: "db_failed" });
    const rows = z.array(SummaryRow).safeParse(data);
    return rows.success ? ok(rows.data.map(toSummary)) : err({ kind: "db_failed" });
  }

  async update(id: string, patch: DocumentPatch): Promise<Result<null, AppError>> {
    const { error } = await this.db
      .from("documents")
      .update({
        ...(patch.status && { status: patch.status }),
        ...(patch.kind && { kind: patch.kind.slice(0, 60) }),
        ...(patch.sourceLang && { source_lang: patch.sourceLang }),
        ...(patch.pages && { extracted_text: joinPages(patch.pages) }),
      })
      .eq("id", id);
    return error ? err({ kind: "db_failed" }) : ok(null);
  }

  async deleteAllOwned(userId: string): Promise<Result<null, AppError>> {
    const { error } = await this.db.from("documents").delete().eq("user_id", userId);
    return error ? err({ kind: "db_failed" }) : ok(null);
  }
}
