import { describe, expect, it } from "vitest";
import {
  daysUntil,
  joinPages,
  MAX_FILE_BYTES,
  splitPages,
  storagePath,
  titleFromFilename,
  validatePageCount,
  validatePastedText,
  validateUpload,
} from "./document";

describe("validateUpload", () => {
  it("accepts PDF, PNG and JPG under 10 MB", () => {
    expect(validateUpload({ mediaType: "application/pdf", size: 1000 })).toEqual({
      ok: true,
      value: "application/pdf",
    });
    expect(validateUpload({ mediaType: "image/jpeg", size: MAX_FILE_BYTES }).ok).toBe(true);
  });
  it("rejects other types, including text/plain uploads", () => {
    expect(validateUpload({ mediaType: "application/msword", size: 10 })).toEqual({
      ok: false,
      error: "unsupported_type",
    });
    expect(validateUpload({ mediaType: "text/plain", size: 10 })).toEqual({
      ok: false,
      error: "unsupported_type",
    });
  });
  it("rejects empty and oversized files", () => {
    expect(validateUpload({ mediaType: "image/png", size: 0 })).toEqual({ ok: false, error: "empty" });
    expect(validateUpload({ mediaType: "image/png", size: MAX_FILE_BYTES + 1 })).toEqual({
      ok: false,
      error: "too_large",
    });
  });
});

describe("validatePastedText / validatePageCount", () => {
  it("needs enough text to explain", () => {
    expect(validatePastedText("  hi  ")).toEqual({ ok: false, error: "empty" });
    expect(validatePastedText("x".repeat(60_001)).ok).toBe(false);
    expect(validatePastedText(`  ${"word ".repeat(20)} `).ok).toBe(true);
  });
  it("caps pages at 20", () => {
    expect(validatePageCount(20).ok).toBe(true);
    expect(validatePageCount(21)).toEqual({ ok: false, error: "too_many_pages" });
    expect(validatePageCount(0)).toEqual({ ok: false, error: "unreadable" });
  });
});

describe("helpers", () => {
  it("builds the private storage path", () => {
    expect(storagePath("u1", "d1", "image/jpeg")).toBe("u1/d1/original.jpg");
  });
  it("derives a readable title", () => {
    expect(titleFromFilename("Lease_final  (2).PDF", "Untitled")).toBe("Lease final (2)");
    expect(titleFromFilename(".pdf", "Untitled")).toBe("Untitled");
  });
  it("round-trips pages through form feeds", () => {
    expect(splitPages(joinPages(["a", "b\fc"]))).toEqual(["a", "b c"]);
    expect(splitPages(null)).toBeNull();
  });
  it("counts days until expiry, never negative", () => {
    const now = new Date("2026-11-11T00:00:00Z");
    expect(daysUntil("2026-12-09T00:00:00Z", now)).toBe(28);
    expect(daysUntil("2026-11-01T00:00:00Z", now)).toBe(0);
  });
});
