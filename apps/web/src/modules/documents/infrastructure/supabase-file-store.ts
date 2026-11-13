import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { FileStore, StoredFile } from "../application/ports";
import { isMediaType } from "../domain/document";

const BUCKET = "documents";

export class SupabaseFileStore implements FileStore {
  // biome-ignore lint/suspicious/noExplicitAny: storage API is schema-independent
  constructor(private readonly db: SupabaseClient<any>) {}

  async put(path: string, file: StoredFile): Promise<Result<null, AppError>> {
    const { error } = await this.db.storage
      .from(BUCKET)
      .upload(path, file.bytes, { contentType: file.mediaType, upsert: false });
    return error ? err({ kind: "storage_failed" }) : ok(null);
  }

  async read(path: string): Promise<Result<StoredFile, AppError>> {
    const { data, error } = await this.db.storage.from(BUCKET).download(path);
    if (error || !data) return err({ kind: "storage_failed" });
    const mediaType = data.type.split(";")[0] ?? "";
    if (!isMediaType(mediaType)) return err({ kind: "storage_failed" });
    return ok({ bytes: new Uint8Array(await data.arrayBuffer()), mediaType });
  }

  async remove(paths: readonly string[]): Promise<Result<null, AppError>> {
    if (paths.length === 0) return ok(null);
    const { error } = await this.db.storage.from(BUCKET).remove([...paths]);
    return error ? err({ kind: "storage_failed" }) : ok(null);
  }

  /** Lists {userId}/{documentId}/* and removes every file. */
  async removeUserFolder(userId: string): Promise<Result<null, AppError>> {
    const bucket = this.db.storage.from(BUCKET);
    const { data: folders, error } = await bucket.list(userId, { limit: 1000 });
    if (error) return err({ kind: "storage_failed" });
    const paths: string[] = [];
    for (const folder of folders ?? []) {
      const { data: files, error: listError } = await bucket.list(`${userId}/${folder.name}`, { limit: 100 });
      if (listError) return err({ kind: "storage_failed" });
      for (const f of files ?? []) paths.push(`${userId}/${folder.name}/${f.name}`);
    }
    if (paths.length === 0) return ok(null);
    const { error: removeError } = await bucket.remove(paths);
    return removeError ? err({ kind: "storage_failed" }) : ok(null);
  }
}
