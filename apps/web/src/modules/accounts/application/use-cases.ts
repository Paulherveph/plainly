import type { AppError } from "@/shared/lib/errors";
import { log, logError } from "@/shared/lib/log";
import type { Mailer } from "@/shared/lib/mailer";
import { err, ok, type Result } from "@/shared/lib/result";
import { confirmsDeletion, ProfilePatch, rehomePath } from "../domain/profile";
import type {
  AccountAdmin,
  AccountDataReader,
  ProfileRepository,
  SubscriptionCanceller,
  Zipper,
} from "./ports";

export function makeUpdateProfile(deps: { profiles: ProfileRepository }) {
  return async (userId: string, input: unknown): Promise<Result<null, AppError>> => {
    const patch = ProfilePatch.safeParse(input);
    if (!patch.success) return err({ kind: "invalid_input", reason: "empty" });
    return deps.profiles.update(userId, patch.data);
  };
}

/**
 * E06: a guest signed in to an existing account. Files move first (and move back if one fails),
 * then one SQL transaction moves every row and deletes the guest.
 */
export function makeMergeGuest(deps: { admin: AccountAdmin }) {
  return async (input: {
    guestId: string;
    userId: string;
  }): Promise<Result<{ documents: number }, AppError>> => {
    if (input.guestId === input.userId) return ok({ documents: 0 });
    if (!(await deps.admin.isGuest(input.guestId))) return err({ kind: "not_found" });

    const paths = await deps.admin.storagePaths(input.guestId);
    if (!paths.ok) return paths;
    const moved: [string, string][] = [];
    for (const from of paths.value) {
      const to = rehomePath(from, input.guestId, input.userId);
      if (!to) continue;
      const res = await deps.admin.moveFile(from, to);
      if (!res.ok) {
        for (const [a, b] of moved.reverse()) await deps.admin.moveFile(b, a);
        logError("account.merge_files_failed", { moved: moved.length });
        return res;
      }
      moved.push([from, to]);
    }

    const merged = await deps.admin.mergeGuest(input.guestId, input.userId);
    if (!merged.ok) {
      for (const [a, b] of moved.reverse()) await deps.admin.moveFile(b, a);
      return merged;
    }
    log("account.merged", { documents: merged.value });
    return ok({ documents: merged.value });
  };
}

/** E11: a zip of JSON (all rows the user owns) plus the original files. */
export function makeExportData(deps: { data: AccountDataReader; zipper: Zipper }) {
  return async (userId: string): Promise<Result<Uint8Array<ArrayBuffer>, AppError>> => {
    const [tables, originals] = await Promise.all([deps.data.tables(userId), deps.data.originals(userId)]);
    if (!tables.ok) return tables;
    if (!originals.ok) return originals;
    const json = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
    const entries = [
      {
        path: "README.txt",
        bytes: new TextEncoder().encode(
          "Your Plainly data: one JSON file per table, and your original files.\n",
        ),
      },
      ...Object.entries(tables.value).map(([name, rows]) => ({
        path: `data/${name}.json`,
        bytes: json(rows),
      })),
      ...originals.value.map((o) => ({ path: `originals/${o.path}`, bytes: o.bytes })),
    ];
    log("account.exported", { files: originals.value.length });
    return ok(deps.zipper.zip(entries));
  };
}

/**
 * E12: type-to-confirm, then subscription, storage, auth user (rows cascade), confirmation email.
 * The ledger keeps no personal data after the user row is gone (user_id is set null).
 */
export function makeDeleteAccount(deps: {
  admin: AccountAdmin;
  subscriptions: SubscriptionCanceller;
  mailer: Mailer | null;
}) {
  return async (input: {
    userId: string;
    email: string | null;
    typed: string;
    word: string;
    notice: { subject: string; text: string };
  }): Promise<Result<null, AppError>> => {
    if (!confirmsDeletion(input.typed, input.word)) return err({ kind: "invalid_input", reason: "empty" });
    const cancelled = await deps.subscriptions.cancelForDeletion(input.userId);
    if (!cancelled.ok) return cancelled;
    const files = await deps.admin.removeUserFolder(input.userId);
    if (!files.ok) return files;
    const deleted = await deps.admin.deleteUser(input.userId);
    if (!deleted.ok) return deleted;
    if (input.email && deps.mailer) {
      const sent = await deps.mailer.send({ to: input.email, ...input.notice });
      if (!sent.ok) logError("account.delete_email_failed", {});
    }
    log("account.deleted", {});
    return ok(null);
  };
}
