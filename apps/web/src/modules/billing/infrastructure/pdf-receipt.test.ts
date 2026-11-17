import { describe, expect, it } from "vitest";
import { renderReceiptPdf } from "./pdf-receipt";

const DOC = {
  brand: "Plainly",
  title: "Receipt PL-20261117-3F9A1C",
  subtitle: "Demo payment (no card was charged)",
  rows: [
    ["Plan", "Pro (monthly)"],
    ["Prix", "12,00\u202f$US"],
  ] as [string, string][],
  total: ["Total", "$12.00"] as [string, string],
  note: "Questions? See plainly (it) on GitHub \\ 中文",
};

describe("receipt PDF", () => {
  const bytes = renderReceiptPdf(DOC);
  const pdf = Buffer.from(bytes).toString("latin1");

  it("is a complete PDF with the receipt lines", () => {
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.endsWith("%%EOF\n")).toBe(true);
    expect(pdf).toContain("(Pro \\(monthly\\))");
    expect(pdf).toContain("($12.00)");
  });

  it("escapes PDF syntax and replaces characters the built-in font cannot draw", () => {
    expect(pdf).toContain("plainly \\(it\\) on GitHub \\\\ ??)");
    expect(pdf).toContain("(12,00 $US)");
  });

  it("points startxref and every xref entry at the right byte", () => {
    const xref = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(xref, xref + 4)).toBe("xref");
    const entries = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(6);
    for (const [i, offset] of entries.entries())
      expect(pdf.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true);
  });
});
