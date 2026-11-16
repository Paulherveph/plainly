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

const AddInput = z.object({
  documentId: z.uuid(),
  locale: z.enum(["en", "fr", "zh"]),
  index: z.number().int().min(0).max(20),
  dueOn: z.iso.date(),
});

/** Turns a relative or ambiguous deadline into a dated one with the date the user picked. */
export async function addDeadlineFromActionAction(
  input: z.input<typeof AddInput>,
): Promise<Result<null, AppError>> {
  const parsed = AddInput.safeParse(input);
  if (!parsed.success) return err({ kind: "invalid_input", reason: "empty" });
  const c = await container();
  const user = await c.currentUser();
  if (!user) return err({ kind: "unauthenticated" });
  const res = await c.addDeadlineFromAction({ userId: user.id, ...parsed.data });
  if (res.ok) revalidatePath("/[locale]/deadlines", "page");
  return res;
}
