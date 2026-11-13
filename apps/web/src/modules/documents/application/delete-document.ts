import type { AppError } from "@/shared/lib/errors";
import { logError } from "@/shared/lib/log";
import { ok, type Result } from "@/shared/lib/result";
import type { DocumentRepository, FileStore } from "./ports";

/**
 * G02: one document and everything derived from it. The row delete cascades to pages,
 * analyses, messages, deadlines and jobs; then the original file goes.
 */
export function makeDeleteDocument(deps: { documents: DocumentRepository; files: FileStore }) {
  return async function deleteDocument(userId: string, documentId: string): Promise<Result<null, AppError>> {
    const deleted = await deps.documents.deleteOwned(userId, documentId);
    if (!deleted.ok) return deleted;
    const removed = await deps.files.remove([deleted.value.storagePath]);
    if (!removed.ok) logError("document.file_remove_failed", { documentId });
    return ok(null);
  };
}
