"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { container } from "@/server/container";
import type { AppError } from "@/shared/lib/errors";
import { err, type Result } from "@/shared/lib/result";

const Input = z.object({ id: z.uuid(), done: z.boolean() });

export async function setDeadlineDoneAction(id: string, done: boolean): Promise<Result<null, AppError>> {
  const parsed = Input.safeParse({ id, done });
  if (!parsed.success) return err({ kind: "invalid_input", reason: "empty" });
  const c = await container();
  const user = await c.currentUser();
  if (!user) return err({ kind: "unauthenticated" });
  const res = await c.setDeadlineDone(user.id, parsed.data.id, parsed.data.done);
  if (res.ok) revalidatePath("/[locale]/deadlines", "page");
  return res;
}
