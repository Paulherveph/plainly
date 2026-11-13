"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { container } from "@/server/container";
import type { AppError } from "@/shared/lib/errors";
import { log } from "@/shared/lib/log";
import { err, type Result } from "@/shared/lib/result";

/** E10: name, language and theme are saved in the profile. */
export async function updateProfileAction(input: unknown): Promise<Result<null, AppError>> {
  const c = await container();
  const user = await c.currentUser();
  if (!user || user.isAnonymous) return err({ kind: "unauthenticated" });
  const res = await c.updateProfile(user.id, input);
  if (res.ok) revalidatePath("/[locale]/account", "page");
  return res;
}

/** E12: type-to-confirm, then everything goes. The confirmation email is sent in the user's language. */
export async function deleteAccountAction(input: { typed: string; locale: string }): Promise<Result<null, AppError>> {
  const c = await container();
  const user = await c.currentUser();
  if (!user || user.isAnonymous) return err({ kind: "unauthenticated" });
  if (!c.deleteAccount) return err({ kind: "db_failed" });
  const t = await getTranslations({ locale: ["fr", "zh"].includes(input.locale) ? input.locale : "en", namespace: "Account" });
  const res = await c.deleteAccount({
    userId: user.id,
    email: user.email,
    typed: input.typed,
    word: t("deleteWord"),
    notice: { subject: t("deletedEmailSubject"), text: t("deletedEmailBody") },
  });
  log("account.delete_requested", { ok: res.ok });
  return res;
}
