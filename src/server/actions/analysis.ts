"use server";

import { container } from "@/server/container";
import type { AppError } from "@/shared/lib/errors";
import { err, type Result } from "@/shared/lib/result";

/** 60-second signed link to the user's own original file. */
export async function getOriginalUrlAction(documentId: string): Promise<Result<string, AppError>> {
  const c = await container();
  const user = await c.currentUser();
  if (!user) return err({ kind: "unauthenticated" });
  return c.getOriginalUrl(user.id, documentId);
}
