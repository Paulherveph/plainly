import { describe, expect, it } from "vitest";
import {
  detectVisionPages,
  mergeTranscription,
  normalizeForHash,
  sniffMediaType,
  validatePastedText,
  validateUpload,
} from "./document";

const PDF = new TextEncoder().encode("%PDF-1.7\n...");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("text-first helpers", () => {
  it("A03: flags only the scanned pages of a mixed PDF", () => {
    const text = "This lease starts on 1 March 2026 and the rent is due monthly.";
    expect(detectVisionPages([text, "  12 ", text])).toEqual([2]);
  });

  it("A03: merges a transcription into the scanned pages only", () => {
    const merged = mergeTranscription(["page one", "", "page three"], 3, [2], new Map([[2, "scanned two"]]));
    expect(merged).toEqual(["page one", "scanned two", "page three"]);
  });

  it("A16: the content hash input ignores case and whitespace", () => {
    expect(normalizeForHash(["Hello   World\n"])).toBe(normalizeForHash(["hello world"]));
  });

  it("A07: rejects a file whose bytes do not match its declared type", () => {
    expect(sniffMediaType(PDF)).toBe("application/pdf");
    expect(sniffMediaType(PNG)).toBe("image/png");
    expect(validateUpload({ mediaType: "application/pdf", size: 10, head: PNG })).toEqual({
      ok: false,
      error: "unsupported_type",
    });
    expect(validateUpload({ mediaType: "application/pdf", size: 10, head: PDF }).ok).toBe(true);
  });

  it("A08: rejects files above the hard size cap", () => {
    expect(validateUpload({ mediaType: "application/pdf", size: 31 * 1024 * 1024 })).toEqual({
      ok: false,
      error: "too_large",
    });
  });

  it("A10/A11: pasted text that is too short or too long gets a precise reason", () => {
    expect(validatePastedText("short text")).toEqual({ ok: false, error: "too_short" });
    expect(validatePastedText("x".repeat(60_001))).toEqual({ ok: false, error: "too_long" });
    expect(validatePastedText("x".repeat(300)).ok).toBe(true);
  });
});
