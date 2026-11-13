import type { AppError, InvalidInputReason } from "@/shared/lib/errors";
import type { Result } from "@/shared/lib/result";
import type { Document, DocumentStatus, DocumentSummary, MediaType, SampleId } from "../domain/document";

export type StoredFile = { bytes: Uint8Array; mediaType: MediaType };
export type { SampleId };

export type NewDocument = {
  id: string;
  userId: string;
  title: string;
  mediaType: MediaType;
  storagePath: string;
  pageCount: number;
  pages: string[] | null;
  visionPages: number[];
  contentHash: string | null;
  sampleId: SampleId | null;
  /** Plan retention, set by the entitlement check. */
  retentionDays: number;
};

export type DocumentPatch = Partial<{
  status: DocumentStatus;
  kind: string;
  sourceLang: "en" | "fr" | "zh" | "other";
  /** Full page text after a transcription (also refreshes document_pages and the hash). */
  pages: string[];
  contentHash: string;
  chatSummary: string;
}>;

export type PageHit = { page: number; text: string };

export interface DocumentRepository {
  create(doc: NewDocument): Promise<Result<Document, AppError>>;
  getOwned(userId: string, id: string): Promise<Result<Document, AppError>>;
  listOwned(userId: string): Promise<Result<DocumentSummary[], AppError>>;
  update(id: string, patch: DocumentPatch): Promise<Result<null, AppError>>;
  deleteAllOwned(userId: string): Promise<Result<null, AppError>>;
  deleteOwned(userId: string, id: string): Promise<Result<{ storagePath: string }, AppError>>;
  /** Full-text search over one document's pages (no embeddings, no tokens). */
  searchPages(documentId: string, query: string, limit: number): Promise<Result<PageHit[], AppError>>;
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

export type Extracted = {
  pageCount: number;
  /** Null for images (no text layer at all). */
  pages: string[] | null;
  /** 1-based pages that need vision (scanned). */
  visionPages: number[];
};

/** Text per page, used to analyze, verify quotes and ground chat. */
export interface TextExtractor {
  extract(file: StoredFile): Promise<Result<Extracted, InvalidInputReason>>;
}

export interface SampleLibrary {
  load(id: SampleId): Promise<Result<{ title: string; file: StoredFile }, AppError>>;
}

export interface Hasher {
  sha256(input: string | Uint8Array): Promise<string>;
}
