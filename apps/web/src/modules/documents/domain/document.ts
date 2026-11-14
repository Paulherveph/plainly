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

export const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const MEDIA_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  DOCX,
  XLSX,
  PPTX,
] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];
export type OfficeType = typeof DOCX | typeof XLSX | typeof PPTX;
/** Every stored type can be uploaded. Markdown and CSV files are stored as text/plain. */
export const UPLOAD_MEDIA_TYPES: readonly MediaType[] = MEDIA_TYPES;
/** For the file picker. */
export const UPLOAD_ACCEPT = ".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp,.txt,.md,.csv";

export function isOffice(mediaType: MediaType): mediaType is OfficeType {
  return mediaType === DOCX || mediaType === XLSX || mediaType === PPTX;
}

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
  return pages.map((p) => p.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase()).join("\f");
}

/** Bytes read from the start of a file to check its real type. */
export const HEAD_BYTES = 16;

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const startsWith = (b: Uint8Array, sig: readonly number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/**
 * True when the first bytes match the declared type (never trust the name or the browser).
 * Office files are ZIP archives; the extractor then checks the parts inside.
 */
export function matchesSignature(mediaType: MediaType, head: Uint8Array): boolean {
  switch (mediaType) {
    case "application/pdf":
      return startsWith(head, ascii("%PDF-"));
    case "image/png":
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47]);
    case "image/jpeg":
      return startsWith(head, [0xff, 0xd8, 0xff]);
    case "image/webp":
      return startsWith(head, ascii("RIFF")) && startsWith(head, ascii("WEBP"), 8);
    case "text/plain":
      return head.length > 0 && !head.includes(0);
    default:
      return startsWith(head, [0x50, 0x4b, 0x03, 0x04]);
  }
}

const EXTENSIONS: Record<MediaType, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "text/plain": "txt",
  [DOCX]: "docx",
  [XLSX]: "xlsx",
  [PPTX]: "pptx",
};

const BY_EXTENSION: Record<string, MediaType> = {
  ...Object.fromEntries(Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type as MediaType])),
  jpeg: "image/jpeg",
  md: "text/plain",
  markdown: "text/plain",
  csv: "text/plain",
};

export function isMediaType(value: string): value is MediaType {
  return (MEDIA_TYPES as readonly string[]).includes(value);
}

/**
 * The type to validate: the browser's when it is one we store, otherwise the one the file name
 * implies. Browsers often send "" or application/octet-stream for Office files, and
 * text/markdown or text/csv for text we store as text/plain. The bytes are still checked.
 */
export function resolveMediaType(declared: string, fileName: string): string {
  if (isMediaType(declared)) return declared;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? declared;
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
  if (file.head && !matchesSignature(file.mediaType, file.head)) return err("unsupported_type");
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
