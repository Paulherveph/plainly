"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SampleId } from "@/modules/documents/application/ports";
import { titleFromFilename } from "@/modules/documents/domain/document";
import { container } from "@/server/container";
import type { AppError } from "@/shared/lib/errors";
import { log } from "@/shared/lib/log";
import { err, ok, type Result } from "@/shared/lib/result";

type Created = Result<{ id: string }, AppError>;

async function withUser(run: (c: Awaited<ReturnType<typeof container>>, userId: string) => Promise<Created>) {
  const c = await container();
  const user = await c.currentUser();
  if (!user) return err<AppError>({ kind: "unauthenticated" });
  const result = await run(c, user.id);
  log("document.create", { ok: result.ok, error: result.ok ? null : result.error.kind });
  if (result.ok) revalidatePath("/[locale]/documents", "page");
  return result;
}

export async function uploadFileAction(formData: FormData): Promise<Created> {
  const file = formData.get("file");
  if (!(file instanceof File)) return err({ kind: "invalid_input", reason: "empty" });
  return withUser(async (c, userId) =>
    c.uploadDocument({
      userId,
      source: "file",
      title: titleFromFilename(file.name, "Document"),
      mediaType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    }),
  );
}

const PasteInput = z.object({ text: z.string().max(70_000), title: z.string().max(120) });

export async function uploadTextAction(input: { text: string; title: string }): Promise<Created> {
  const parsed = PasteInput.safeParse(input);
  if (!parsed.success) return err({ kind: "invalid_input", reason: "too_large" });
  const title = parsed.data.title.trim() || "Pasted text";
  return withUser((c, userId) => c.uploadDocument({ userId, source: "text", title, text: parsed.data.text }));
}

const Sample = z.enum(["lease", "visa", "offer"]);

export async function createSampleAction(sampleId: SampleId): Promise<Created> {
  const parsed = Sample.safeParse(sampleId);
  if (!parsed.success) return err({ kind: "not_found" });
  return withUser((c, userId) => c.uploadDocument({ userId, source: "sample", sampleId: parsed.data }));
}

/** "Delete everything now": files, documents, analyses, chats and deadlines of the current user. */
export async function deleteEverythingAction(): Promise<Result<null, AppError>> {
  const c = await container();
  const user = await c.currentUser();
  if (!user) return ok(null); // no session, nothing stored
  const result = await c.deleteEverything(user.id);
  log("privacy.delete_everything", { ok: result.ok, error: result.ok ? null : result.error.kind });
  if (result.ok) revalidatePath("/[locale]", "layout");
  return result;
}
