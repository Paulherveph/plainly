import type { InvalidInputReason } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PAGES = 20;
export const MAX_PASTE_CHARS = 60_000;
export const MIN_PASTE_CHARS = 40;
export const RETENTION_DAYS = 30;

export const MEDIA_TYPES = ["application/pdf", "image/png", "image/jpeg", "text/plain"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];
export const UPLOAD_MEDIA_TYPES: readonly MediaType[] = ["application/pdf", "image/png", "image/jpeg"];

export const DOCUMENT_STATUSES = ["uploaded", "analyzing", "ready", "failed"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export type DocumentSummary = {
  id: string;
  title: string;
  kind: string | null;
  status: DocumentStatus;
  pageCount: number;
  createdAt: string;
  expiresAt: string;
};

export type Document = DocumentSummary & {
  userId: string;
  mediaType: MediaType;
  storagePath: string;
  sourceLang: string | null;
  /** One entry per page. Null until text is known (images are transcribed at analysis time). */
  pages: string[] | null;
};

const EXTENSIONS: Record<MediaType, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "text/plain": "txt",
};

export function isMediaType(value: string): value is MediaType {
  return (MEDIA_TYPES as readonly string[]).includes(value);
}

/** Checks type and size before anything is read or stored. */
export function validateUpload(file: {
  mediaType: string;
  size: number;
}): Result<MediaType, InvalidInputReason> {
  if (!isMediaType(file.mediaType) || !UPLOAD_MEDIA_TYPES.includes(file.mediaType))
    return err("unsupported_type");
  if (file.size === 0) return err("empty");
  if (file.size > MAX_FILE_BYTES) return err("too_large");
  return ok(file.mediaType);
}

export function validatePastedText(text: string): Result<string, InvalidInputReason> {
  const trimmed = text.trim();
  if (trimmed.length < MIN_PASTE_CHARS) return err("empty");
  if (trimmed.length > MAX_PASTE_CHARS) return err("too_large");
  return ok(trimmed);
}

export function validatePageCount(pageCount: number): Result<number, InvalidInputReason> {
  if (pageCount < 1) return err("unreadable");
  if (pageCount > MAX_PAGES) return err("too_many_pages");
  return ok(pageCount);
}

export function storagePath(userId: string, documentId: string, mediaType: MediaType): string {
  return `${userId}/${documentId}/original.${EXTENSIONS[mediaType]}`;
}

/** "Lease_final (2).pdf" -> "Lease final (2)". Falls back when nothing readable is left. */
export function titleFromFilename(name: string, fallback: string): string {
  const title = name
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return title.length > 0 ? title : fallback;
}

/** Splits stored text (pages joined by form feed) back into pages. */
export function splitPages(text: string | null): string[] | null {
  return text === null ? null : text.split("\f");
}

export function joinPages(pages: readonly string[]): string {
  return pages.map((p) => p.replaceAll("\f", " ")).join("\f");
}

export function daysUntil(isoDateTime: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(isoDateTime).getTime() - now.getTime()) / 86_400_000));
}
