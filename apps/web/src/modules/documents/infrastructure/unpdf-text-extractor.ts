import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import type { InvalidInputReason } from "@/shared/lib/errors";
import { chunkText, readDocx, readPptx, readXlsx, sheetText, slideText } from "@/shared/lib/office";
import { err, ok, type Result } from "@/shared/lib/result";
import type { Extracted, StoredFile, TextExtractor } from "../application/ports";
import { DOCX, detectVisionPages, MAX_PAGES, MAX_TEXT_CHARS, PPTX, XLSX } from "../domain/document";

const PARSE_TIMEOUT_MS = 15_000;

/**
 * Text first: PDFs keep page boundaries, and pages without a usable text layer are flagged
 * for vision. Images have no text layer at all. Word pages, Excel sheets and PowerPoint slides
 * each become one page, and never go to vision (the model cannot read those files).
 * Parsing is capped (pages, characters, time) and never evaluates JavaScript inside the PDF.
 */
export class UnpdfTextExtractor implements TextExtractor {
  async extract(file: StoredFile): Promise<Result<Extracted, InvalidInputReason>> {
    switch (file.mediaType) {
      case "text/plain":
        return extractPlainText(file.bytes);
      case "image/png":
      case "image/jpeg":
      case "image/webp":
        return ok({ pageCount: 1, pages: null, visionPages: [1] });
      case "application/pdf":
        return withTimeout(extractPdf(file.bytes), PARSE_TIMEOUT_MS);
      case DOCX:
        return textPages(readDocx(file.bytes));
      case XLSX:
        return textPages(mapOk(readXlsx(file.bytes), (sheets) => sheets.map(sheetText)));
      case PPTX:
        return textPages(mapOk(readPptx(file.bytes), (slides) => slides.map(slideText)));
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

/** A pasted or uploaded text file. Must be UTF-8 (a binary file renamed .txt is rejected). */
function extractPlainText(bytes: Uint8Array): Result<Extracted, InvalidInputReason> {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return err("unreadable");
  }
  return textPages(ok(chunkText(text.replace(/\r\n?/g, "\n"))));
}

function mapOk<T, U>(r: Result<T, InvalidInputReason>, f: (v: T) => U): Result<U, InvalidInputReason> {
  return r.ok ? ok(f(r.value)) : r;
}

/** Office and text files: every page is text, so nothing goes to vision. */
function textPages(r: Result<string[], InvalidInputReason>): Result<Extracted, InvalidInputReason> {
  if (!r.ok) return r;
  const pages = r.value;
  if (pages.length > MAX_PAGES) return err("too_many_pages");
  if (pages.reduce((n, p) => n + p.length, 0) > MAX_TEXT_CHARS) return err("too_large");
  if (!pages.some((p) => p.trim())) return err("empty");
  return ok({ pageCount: pages.length, pages, visionPages: [] });
}

function withTimeout<T>(work: Promise<Result<T, InvalidInputReason>>, ms: number) {
  return Promise.race([
    work,
    new Promise<Result<T, InvalidInputReason>>((resolve) => setTimeout(() => resolve(err("unreadable")), ms)),
  ]);
}
