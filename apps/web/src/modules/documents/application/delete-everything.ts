import type { AppError } from "@/shared/lib/errors";
import type { Result } from "@/shared/lib/result";
import type { DocumentRepository, FileStore } from "./ports";

/** Files first, then rows (analyses, messages, deadlines cascade). */
export function makeDeleteEverything(deps: { documents: DocumentRepository; files: FileStore }) {
  return async function deleteEverything(userId: string): Promise<Result<null, AppError>> {
    const files = await deps.files.removeUserFolder(userId);
    if (!files.ok) return files;
    return deps.documents.deleteAllOwned(userId);
  };
}
