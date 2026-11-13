import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/db-types";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { ProfileRepository } from "../application/ports";
import { type Profile, type ProfilePatch, THEMES } from "../domain/profile";

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async get(userId: string): Promise<Result<Profile, AppError>> {
    const { data, error } = await this.db
      .from("profiles")
      .select("user_id, display_name, locale, theme")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return err({ kind: "db_failed" });
    if (!data) return err({ kind: "not_found" });
    const locale = data.locale === "fr" || data.locale === "zh" ? data.locale : "en";
    const theme = THEMES.find((t) => t === data.theme) ?? "system";
    return ok({ userId: data.user_id, displayName: data.display_name, locale, theme });
  }

  async update(userId: string, patch: ProfilePatch): Promise<Result<null, AppError>> {
    const { error } = await this.db
      .from("profiles")
      .update({
        ...(patch.displayName !== undefined && { display_name: patch.displayName }),
        ...(patch.locale && { locale: patch.locale }),
        ...(patch.theme && { theme: patch.theme }),
      })
      .eq("user_id", userId);
    return error ? err({ kind: "db_failed" }) : ok(null);
  }
}
