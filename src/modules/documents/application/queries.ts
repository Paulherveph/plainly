import type { AppError } from "@/shared/lib/errors";
import type { Result } from "@/shared/lib/result";
import type { Document, DocumentSummary } from "../domain/document";
import type { DocumentRepository, FileStore, StoredFile } from "./ports";

export function makeListDocuments(deps: { documents: DocumentRepository }) {
  return (userId: string): Promise<Result<DocumentSummary[], AppError>> => deps.documents.listOwned(userId);
}

export function makeGetDocument(deps: { documents: DocumentRepository }) {
  return (userId: string, id: string): Promise<Result<Document, AppError>> =>
    deps.documents.getOwned(userId, id);
}

/** The uploaded file itself, for the owner only (served same-origin for the inline preview). */
export function makeReadOriginal(deps: { documents: DocumentRepository; files: FileStore }) {
  return async (userId: string, id: string): Promise<Result<StoredFile, AppError>> => {
    const doc = await deps.documents.getOwned(userId, id);
    return doc.ok ? deps.files.read(doc.value.storagePath) : doc;
  };
}
