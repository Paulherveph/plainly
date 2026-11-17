import "server-only";

/**
 * A one-page A4 PDF written by hand (PDF 1.4, the two built-in Helvetica fonts), so receipts need no
 * dependency. Built-in fonts cover Latin-1 only: other characters print as "?", which is why the route
 * prints Chinese receipts in English.
 */
export type ReceiptDocument = {
  brand: string;
  title: string;
  subtitle: string;
  rows: [label: string, value: string][];
  total: [label: string, value: string];
  note: string;
};

/** Typography that formatters and French copy use, mapped to Latin-1 look-alikes. */
const LOOKALIKE: Record<string, string> = {
  "\u202f": " ",
  "\u2009": " ",
  "\u2019": "'",
  "\u2013": "-",
  "\u2014": "-",
  "\u2026": "...",
};

function text(value: string): string {
  const latin1 = [...value].map((c) => LOOKALIKE[c] ?? (c.charCodeAt(0) <= 0xff ? c : "?")).join("");
  return `(${latin1.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

function line(font: "F1" | "F2", size: number, x: number, y: number, value: string): string {
  return `BT /${font} ${size} Tf ${x} ${y} Td ${text(value)} Tj ET`;
}

export function renderReceiptPdf(doc: ReceiptDocument): Uint8Array<ArrayBuffer> {
  const ops: string[] = [
    "0.580 0.471 1 rg 0 806 595 36 re f", // brand bar, #9478FF
    "0.08 0.07 0.11 rg",
    line("F2", 20, 56, 760, doc.brand),
    line("F2", 15, 56, 724, doc.title),
    "0.42 0.42 0.46 rg",
    line("F1", 10, 56, 706, doc.subtitle),
  ];
  let y = 664;
  for (const [label, value] of doc.rows) {
    ops.push(
      "0.42 0.42 0.46 rg",
      line("F1", 11, 56, y, label),
      "0.08 0.07 0.11 rg",
      line("F1", 11, 260, y, value),
    );
    y -= 24;
  }
  ops.push(
    `0.85 0.85 0.88 RG 0.8 w 56 ${y + 8} m 539 ${y + 8} l S`,
    "0.08 0.07 0.11 rg",
    line("F2", 12, 56, y - 14, doc.total[0]),
    line("F2", 12, 260, y - 14, doc.total[1]),
    "0.42 0.42 0.46 rg",
    line("F1", 9, 56, 72, doc.note),
  );
  const content = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character is Latin-1 here, so one character is one byte and the offsets above are exact.
  return Uint8Array.from(pdf, (c) => c.charCodeAt(0));
}
