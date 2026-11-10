import type { AppError } from "@/shared/lib/errors";
import { ok, type Result } from "@/shared/lib/result";
import type { Document, DocumentSummary } from "../domain/document";
import type { DocumentRepository, FileStore } from "./ports";

export const SIGNED_URL_SECONDS = 60;

export function makeListDocuments(deps: { documents: DocumentRepository }) {
  return (userId: string): Promise<Result<DocumentSummary[], AppError>> => deps.documents.listOwned(userId);
}

export function makeGetDocument(deps: { documents: DocumentRepository }) {
  return (userId: string, id: string): Promise<Result<Document, AppError>> =>
    deps.documents.getOwned(userId, id);
}

/** Short-lived link to the original file (PRD: signed URLs expire in 60 s). */
export function makeGetOriginalUrl(deps: { documents: DocumentRepository; files: FileStore }) {
  return async (userId: string, id: string): Promise<Result<string, AppError>> => {
    const doc = await deps.documents.getOwned(userId, id);
    if (!doc.ok) return doc;
    const url = await deps.files.signedUrl(doc.value.storagePath, SIGNED_URL_SECONDS);
    return url.ok ? ok(url.value) : url;
  };
}
