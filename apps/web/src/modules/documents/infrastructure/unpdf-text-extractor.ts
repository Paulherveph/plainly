import "server-only";
import { extractText } from "unpdf";
import type { InvalidInputReason } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { StoredFile, TextExtractor } from "../application/ports";

/** Plain text is one page. PDFs keep page boundaries. Images have no text layer (no OCR, by design). */
export class UnpdfTextExtractor implements TextExtractor {
  async extract(
    file: StoredFile,
  ): Promise<Result<{ pageCount: number; pages: string[] | null }, InvalidInputReason>> {
    switch (file.mediaType) {
      case "text/plain":
        return ok({ pageCount: 1, pages: [new TextDecoder().decode(file.bytes)] });
      case "image/png":
      case "image/jpeg":
        return ok({ pageCount: 1, pages: null });
      case "application/pdf":
        try {
          // unpdf may detach the buffer it receives, so give it a copy.
          const { totalPages, text } = await extractText(file.bytes.slice(), { mergePages: false });
          const pages = Array.isArray(text) ? text : [text];
          const hasText = pages.some((p) => p.trim().length > 0);
          // A scanned PDF without a text layer is still analysable (Claude reads it); quotes get transcribed later.
          return ok({ pageCount: totalPages, pages: hasText ? pages : null });
        } catch {
          return err("unreadable");
        }
    }
  }
}
