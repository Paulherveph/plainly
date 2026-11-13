import "server-only";
import { cookies } from "next/headers";
import { makeMergeGuest } from "@/modules/accounts/application/use-cases";
import { SupabaseAccountAdmin } from "@/modules/accounts/infrastructure/supabase-account-admin";
import { SupabaseFileStore } from "@/modules/documents/infrastructure/supabase-file-store";
import { serverEnv } from "@/shared/config/env";
import { log } from "@/shared/lib/log";
import { signValue, verifyValue } from "@/shared/lib/signed-value";
import { createSupabaseAdmin } from "./supabase-admin";

const COOKIE = "plainly_guest_merge";
const TTL_SECONDS = 15 * 60;

/** Before a guest signs in to an existing account: remember who they were (httpOnly, signed, 15 min). */
export async function rememberGuest(guestId: string): Promise<void> {
  const secret = serverEnv().GUEST_MERGE_SECRET;
  if (!secret) return;
  (await cookies()).set(COOKIE, await signValue(guestId, secret, TTL_SECONDS), {
    httpOnly: true,
    secure: serverEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

/**
 * After sign-in: if a valid guest cookie is present, move the guest's data into this account.
 * Returns the number of documents moved (0 when there was nothing to merge).
 */
export async function mergeRememberedGuest(userId: string): Promise<number> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return 0;
  store.delete(COOKIE);
  const secret = serverEnv().GUEST_MERGE_SECRET;
  const admin = createSupabaseAdmin();
  if (!secret || !admin) return 0;
  const guestId = await verifyValue(token, secret);
  if (!guestId || guestId === userId) return 0;
  const merge = makeMergeGuest({ admin: new SupabaseAccountAdmin(admin, new SupabaseFileStore(admin)) });
  const res = await merge({ guestId, userId });
  log("auth.guest_merge", { ok: res.ok, documents: res.ok ? res.value.documents : 0 });
  return res.ok ? res.value.documents : 0;
}
