import { describe, expect, it } from "vitest";
import { DEFAULT_NEXT, safeNext } from "./safe-next";

describe("safeNext (E13)", () => {
  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "javascript:alert(1)",
    "/%0a//evil.com\\x",
    "",
    null,
  ])("rejects %s", (value) => {
    expect(safeNext(value)).toBe(DEFAULT_NEXT);
  });

  it("keeps same-site paths with query", () => {
    expect(safeNext("/fr/documents/abc?lang=zh")).toBe("/fr/documents/abc?lang=zh");
  });
});
