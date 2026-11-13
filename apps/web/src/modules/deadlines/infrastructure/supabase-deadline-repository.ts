import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/shared/lib/db-types";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { DeadlineRepository } from "../application/ports";
import type { Deadline, NewDeadline } from "../domain/deadline";

const Row = z.object({
  id: z.uuid(),
  document_id: z.uuid(),
  label: z.string(),
  detail: z.string().nullable(),
  due_on: z.string(),
  quote: z.string(),
  page: z.number().nullable(),
  done: z.boolean(),
  documents: z.object({ title: z.string() }).nullable(),
});

export class SupabaseDeadlineRepository implements DeadlineRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async countForDocument(documentId: string): Promise<Result<number, AppError>> {
    const { count, error } = await this.db
      .from("deadlines")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId);
    return error ? err({ kind: "db_failed" }) : ok(count ?? 0);
  }

  async insertMany(
    userId: string,
    documentId: string,
    items: readonly NewDeadline[],
  ): Promise<Result<null, AppError>> {
    const { error } = await this.db.from("deadlines").insert(
      items.map((d) => ({
        user_id: userId,
        document_id: documentId,
        label: d.label,
        detail: d.detail,
        due_on: d.dueOn,
        quote: d.quote,
        page: d.page,
      })),
    );
    return error ? err({ kind: "db_failed" }) : ok(null);
  }

  async listOwned(userId: string): Promise<Result<Deadline[], AppError>> {
    const { data, error } = await this.db
      .from("deadlines")
      .select("id, document_id, label, detail, due_on, quote, page, done, documents(title)")
      .eq("user_id", userId)
      .order("due_on", { ascending: true })
      .limit(500);
    if (error) return err({ kind: "db_failed" });
    const rows = z.array(Row).safeParse(data);
    if (!rows.success) return err({ kind: "db_failed" });
    return ok(
      rows.data.map((r) => ({
        id: r.id,
        documentId: r.document_id,
        documentTitle: r.documents?.title ?? "",
        label: r.label,
        detail: r.detail,
        dueOn: r.due_on,
        quote: r.quote,
        page: r.page,
        done: r.done,
      })),
    );
  }

  async setDone(userId: string, id: string, done: boolean): Promise<Result<null, AppError>> {
    const { data, error } = await this.db
      .from("deadlines")
      .update({ done })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id");
    if (error) return err({ kind: "db_failed" });
    return data.length === 1 ? ok(null) : err({ kind: "not_found" });
  }
}
