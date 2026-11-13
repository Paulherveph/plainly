import type { AppError, InvalidInputReason } from "@/shared/lib/errors";
import type { Result } from "@/shared/lib/result";
import type { Document, DocumentStatus, DocumentSummary, MediaType } from "../domain/document";

export type StoredFile = { bytes: Uint8Array; mediaType: MediaType };

export type NewDocument = {
  id: string;
  userId: string;
  title: string;
  mediaType: MediaType;
  storagePath: string;
  pageCount: number;
  pages: string[] | null;
};

export type DocumentPatch = Partial<{
  status: DocumentStatus;
  kind: string;
  sourceLang: "en" | "fr" | "zh" | "other";
  pages: string[];
}>;

export interface DocumentRepository {
  create(doc: NewDocument): Promise<Result<Document, AppError>>;
  getOwned(userId: string, id: string): Promise<Result<Document, AppError>>;
  listOwned(userId: string): Promise<Result<DocumentSummary[], AppError>>;
  update(id: string, patch: DocumentPatch): Promise<Result<null, AppError>>;
  deleteAllOwned(userId: string): Promise<Result<null, AppError>>;
}

/** Service-side access for retention only (bypasses RLS; never used for user requests). */
export interface ExpiredDocuments {
  listExpired(before: Date, limit: number): Promise<Result<{ id: string; storagePath: string }[], AppError>>;
  deleteByIds(ids: readonly string[]): Promise<Result<null, AppError>>;
}

export interface FileStore {
  put(path: string, file: StoredFile): Promise<Result<null, AppError>>;
  read(path: string): Promise<Result<StoredFile, AppError>>;
  removeUserFolder(userId: string): Promise<Result<null, AppError>>;
  remove(paths: readonly string[]): Promise<Result<null, AppError>>;
}

/** Text per page, used to verify quotes and ground chat. Images have no text layer: pages is null. */
export interface TextExtractor {
  extract(
    file: StoredFile,
  ): Promise<Result<{ pageCount: number; pages: string[] | null }, InvalidInputReason>>;
}

export type SampleId = "lease" | "visa" | "offer";

export interface SampleLibrary {
  load(id: SampleId): Promise<Result<{ title: string; file: StoredFile }, AppError>>;
}
