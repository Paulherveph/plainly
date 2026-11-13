"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { flagStore } from "@/server/ai";
import { createSupabase } from "@/server/supabase";
import type { AppError } from "@/shared/lib/errors";
import { log } from "@/shared/lib/log";
import { err, ok, type Result } from "@/shared/lib/result";

/** The only writable thing on /admin. Keys are limited to the documented switches. */
const FlagKey = z.union([
  z.literal("ai_enabled"),
  z.string().regex(/^provider_disabled:[a-z]+$/),
  z.string().regex(/^profile_override:(analysis|chat|chat_deep|fast|translate)$/),
]);

export async function setFlagAction(input: { key: string; value: unknown }): Promise<Result<null, AppError>> {
  const supabase = await createSupabase();
  const { data: admin } = await supabase.rpc("is_admin");
  // Admin rights come from the admins table, never from a client claim.
  if (admin !== true) return err({ kind: "not_found" });
  const key = FlagKey.safeParse(input.key);
  if (!key.success) return err({ kind: "invalid_input", reason: "empty" });
  await flagStore().set(key.data, input.value);
  log("admin.flag_set", { key: key.data });
  revalidatePath("/[locale]/admin", "page");
  return ok(null);
}
