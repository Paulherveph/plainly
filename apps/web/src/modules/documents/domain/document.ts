import type { InvalidInputReason } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";

/** Hard caps for any plan. Plan limits (smaller) are checked by the entitlement service. */
export const MAX_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_PAGES = 100;
export const MAX_PASTE_CHARS = 60_000;
export const MIN_PASTE_CHARS = 200;
/** Total extracted characters: protects against decompression bombs and huge text layers. */
export const MAX_TEXT_CHARS = 1_500_000;
/** A page with fewer useful characters than this is treated as scanned (needs vision). */
export const MIN_PAGE_CHARS = 40;
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

export const SAMPLE_IDS = ["lease", "visa", "offer"] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

export type Document = DocumentSummary & {
  userId: string;
  mediaType: MediaType;
  storagePath: string;
  sourceLang: string | null;
  /** One entry per page. Null until text is known (images are transcribed at analysis time). */
  pages: string[] | null;
  /** 1-based pages without a usable text layer. Emptied once they are transcribed. */
  visionPages: number[];
  /** sha256 of the normalized text (or of the bytes for scans), for the analysis cache. */
  contentHash: string | null;
  sampleId: SampleId | null;
  /** Rolling summary of older chat turns (history trimming). */
  chatSummary: string | null;
};

/** Pages that look scanned: almost no letters or digits in the text layer. */
export function detectVisionPages(pages: readonly string[]): number[] {
  const out: number[] = [];
  pages.forEach((page, i) => {
    const useful = page.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
    if (useful < MIN_PAGE_CHARS) out.push(i + 1);
  });
  return out;
}

/** True when the document still needs a transcription before analysis or chat. */
export function needsTranscription(doc: Pick<Document, "pages" | "visionPages">): boolean {
  return doc.pages === null || doc.visionPages.length > 0;
}

/** Replaces the scanned pages with their transcription; text pages are kept as extracted. */
export function mergeTranscription(
  pages: readonly string[] | null,
  pageCount: number,
  visionPages: readonly number[],
  transcribed: ReadonlyMap<number, string>,
): string[] {
  const base = pages ? [...pages] : Array.from({ length: pageCount }, () => "");
  const wanted = pages === null ? base.map((_, i) => i + 1) : visionPages;
  for (const n of wanted) base[n - 1] = transcribed.get(n) ?? base[n - 1] ?? "";
  return base;
}

/** Input to the content hash: whitespace and case differences must not defeat the cache. */
export function normalizeForHash(pages: readonly string[]): string {
  return pages
    .map((p) => p.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase())
    .join("\f");
}

/** Checks the real file type from its first bytes (never trust the extension). */
export function sniffMediaType(bytes: Uint8Array): MediaType | null {
  const b = bytes;
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d)
    return "application/pdf";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

const EXTENSIONS: Record<MediaType, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "text/plain": "txt",
};

export function isMediaType(value: string): value is MediaType {
  return (MEDIA_TYPES as readonly string[]).includes(value);
}

/**
 * Checks type and size before anything is read or stored. The declared type must match the
 * magic bytes, so a renamed or corrupted file is rejected before it reaches storage.
 */
export function validateUpload(file: {
  mediaType: string;
  size: number;
  head?: Uint8Array;
}): Result<MediaType, InvalidInputReason> {
  if (!isMediaType(file.mediaType) || !UPLOAD_MEDIA_TYPES.includes(file.mediaType))
    return err("unsupported_type");
  if (file.size === 0) return err("empty");
  if (file.size > MAX_FILE_BYTES) return err("too_large");
  if (file.head && sniffMediaType(file.head) !== file.mediaType) return err("unsupported_type");
  return ok(file.mediaType);
}

export function validatePastedText(text: string): Result<string, InvalidInputReason> {
  const trimmed = text.trim();
  if (trimmed.length === 0) return err("empty");
  if (trimmed.length < MIN_PASTE_CHARS) return err("too_short");
  if (trimmed.length > MAX_PASTE_CHARS) return err("too_long");
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
