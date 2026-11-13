import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FileStore } from "@/modules/documents/application/ports";
import type { Database } from "@/shared/lib/db-types";
import { logError } from "@/shared/lib/log";
import { err, ok } from "@/shared/lib/result";
import type { AccountAdmin } from "../application/ports";

const BUCKET = "documents";

/** Service-role adapter. Every call here was authorized by the server before it is made. */
export class SupabaseAccountAdmin implements AccountAdmin {
  constructor(
    private readonly admin: SupabaseClient<Database>,
    private readonly files: FileStore,
  ) {}

  async isGuest(userId: string): Promise<boolean> {
    const { data, error } = await this.admin.auth.admin.getUserById(userId);
    if (error || !data.user) return false;
    const verified = (data.user.identities ?? []).some((i) => i.provider !== "anonymous");
    return data.user.is_anonymous === true && !verified && !data.user.email_confirmed_at;
  }

  async storagePaths(userId: string) {
    const { data, error } = await this.admin.from("documents").select("storage_path").eq("user_id", userId);
    return error ? err({ kind: "db_failed" as const }) : ok((data ?? []).map((r) => r.storage_path));
  }

  async moveFile(from: string, to: string) {
    const { error } = await this.admin.storage.from(BUCKET).move(from, to);
    if (error) logError("account.move_failed", {});
    return error ? err({ kind: "storage_failed" as const }) : ok(null);
  }

  async mergeGuest(guestId: string, userId: string) {
    const { data, error } = await this.admin.rpc("merge_guest", { p_guest: guestId, p_user: userId });
    if (error) logError("account.merge_failed", { code: error.code });
    return error ? err({ kind: "db_failed" as const }) : ok(Number(data ?? 0));
  }

  removeUserFolder(userId: string) {
    return this.files.removeUserFolder(userId);
  }

  async deleteUser(userId: string) {
    const { error } = await this.admin.auth.admin.deleteUser(userId);
    if (error) logError("account.delete_failed", { status: error.status ?? 0 });
    return error ? err({ kind: "db_failed" as const }) : ok(null);
  }
}
