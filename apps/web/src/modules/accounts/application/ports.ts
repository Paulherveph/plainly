import type { AppError } from "@/shared/lib/errors";
import type { Result } from "@/shared/lib/result";
import type { ActivityDay } from "../domain/activity";
import type { Profile, ProfilePatch } from "../domain/profile";

export interface ProfileRepository {
  get(userId: string): Promise<Result<Profile, AppError>>;
  update(userId: string, patch: ProfilePatch): Promise<Result<null, AppError>>;
}

/** Service-role operations on accounts. Only called after the server checked the session. */
export interface AccountAdmin {
  /** True only for an anonymous user without any verified identity. */
  isGuest(userId: string): Promise<boolean>;
  storagePaths(userId: string): Promise<Result<string[], AppError>>;
  moveFile(from: string, to: string): Promise<Result<null, AppError>>;
  mergeGuest(guestId: string, userId: string): Promise<Result<number, AppError>>;
  removeUserFolder(userId: string): Promise<Result<null, AppError>>;
  deleteUser(userId: string): Promise<Result<null, AppError>>;
}

/** Everything a user owns, for "Export my data" (E11). Read through the session (RLS). */
export interface AccountDataReader {
  tables(userId: string): Promise<Result<Record<string, unknown[]>, AppError>>;
  originals(userId: string): Promise<Result<{ path: string; bytes: Uint8Array }[], AppError>>;
}

export interface Zipper {
  zip(entries: { path: string; bytes: Uint8Array }[]): Uint8Array<ArrayBuffer>;
}

/** Cancels any paid subscription before an account is deleted (billing implements it in S4). */
export interface SubscriptionCanceller {
  cancelForDeletion(userId: string): Promise<Result<null, AppError>>;
}

/** The signed-in user's documents explained and questions asked per day, for the activity graph. */
export interface ActivityReader {
  lastYear(): Promise<ActivityDay[]>;
}
