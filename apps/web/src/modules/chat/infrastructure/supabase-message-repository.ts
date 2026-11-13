import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Cite } from "@/modules/analysis/domain/analysis";
import type { Database, Json } from "@/shared/lib/db-types";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { MessageRepository, StoredMessage } from "../application/ports";

/** Stored as UI-message parts so the chat can be restored as-is. */
const Parts = z.array(
  z.union([
    z.object({ type: z.literal("text"), text: z.string() }),
    z.object({
      type: z.literal("data-citations"),
      data: z.object({ citations: z.array(Cite), refused: z.boolean() }),
    }),
  ]),
);

const Row = z.object({
  id: z.uuid(),
  role: z.enum(["user", "assistant"]),
  parts: z.unknown(),
  created_at: z.string(),
});

export class SupabaseMessageRepository implements MessageRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(documentId: string, limit: number): Promise<Result<StoredMessage[], AppError>> {
    const { data, error } = await this.db
      .from("messages")
      .select("id, role, parts, created_at")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return err({ kind: "db_failed" });
    const messages: StoredMessage[] = [];
    for (const raw of data ?? []) {
      const row = Row.safeParse(raw);
      const parts = row.success ? Parts.safeParse(row.data.parts) : null;
      if (!row.success || !parts?.success) continue;
      const text = parts.data.find((p) => p.type === "text");
      const meta = parts.data.find((p) => p.type === "data-citations");
      messages.push({
        id: row.data.id,
        role: row.data.role,
        text: text?.type === "text" ? text.text : "",
        citations: meta?.type === "data-citations" ? meta.data.citations : [],
        refused: meta?.type === "data-citations" ? meta.data.refused : false,
        createdAt: row.data.created_at,
      });
    }
    return ok(messages.reverse());
  }

  async append(
    userId: string,
    documentId: string,
    m: { role: "user" | "assistant"; text: string; citations: Cite[]; refused: boolean },
  ): Promise<Result<null, AppError>> {
    const parts =
      m.role === "user"
        ? [{ type: "text", text: m.text }]
        : [
            { type: "text", text: m.text },
            { type: "data-citations", data: { citations: m.citations, refused: m.refused } },
          ];
    const { error } = await this.db
      .from("messages")
      .insert({ user_id: userId, document_id: documentId, role: m.role, parts: parts as unknown as Json });
    return error ? err({ kind: "db_failed" }) : ok(null);
  }
}
