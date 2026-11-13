import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import type { InvalidInputReason } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { Extracted, StoredFile, TextExtractor } from "../application/ports";
import { detectVisionPages, MAX_PAGES, MAX_TEXT_CHARS } from "../domain/document";

const PARSE_TIMEOUT_MS = 15_000;

/**
 * Text first: PDFs keep page boundaries, and pages without a usable text layer are flagged
 * for vision. Images have no text layer at all. Parsing is capped (pages, characters, time)
 * and never evaluates JavaScript inside the PDF.
 */
export class UnpdfTextExtractor implements TextExtractor {
  async extract(file: StoredFile): Promise<Result<Extracted, InvalidInputReason>> {
    switch (file.mediaType) {
      case "text/plain":
        return ok({ pageCount: 1, pages: [new TextDecoder().decode(file.bytes)], visionPages: [] });
      case "image/png":
      case "image/jpeg":
        return ok({ pageCount: 1, pages: null, visionPages: [1] });
      case "application/pdf":
        return withTimeout(extractPdf(file.bytes), PARSE_TIMEOUT_MS);
    }
  }
}

async function extractPdf(bytes: Uint8Array): Promise<Result<Extracted, InvalidInputReason>> {
  try {
    // unpdf may detach the buffer it receives, so give it a copy.
    const pdf = await getDocumentProxy(bytes.slice(), { isEvalSupported: false });
    if (pdf.numPages > MAX_PAGES) return err("too_many_pages");
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    if (pages.reduce((n, p) => n + p.length, 0) > MAX_TEXT_CHARS) return err("too_large");
    const visionPages = detectVisionPages(pages);
    const noTextAtAll = visionPages.length === pages.length;
    return ok({ pageCount: totalPages, pages: noTextAtAll ? null : pages, visionPages });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name ?? "";
    return err(name === "PasswordException" ? "encrypted" : "unreadable");
  }
}

function withTimeout<T>(work: Promise<Result<T, InvalidInputReason>>, ms: number) {
  return Promise.race([
    work,
    new Promise<Result<T, InvalidInputReason>>((resolve) => setTimeout(() => resolve(err("unreadable")), ms)),
  ]);
}
