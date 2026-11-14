/**
 * Reads the text of Word, Excel and PowerPoint files (DOCX, XLSX, PPTX). These are ZIP archives
 * of XML, so only the XML parts are unpacked, with a size cap against zip bombs. Pure: used by
 * the server text extractor and by the browser preview.
 */
import { strFromU8, unzipSync } from "fflate";
import type { InvalidInputReason } from "./errors";
import { err, ok, type Result } from "./result";

export type Sheet = { name: string; rows: string[][] };
export type Slide = { title: string; lines: string[] };

/** Unpacked XML is capped: a 30 MB upload can expand far beyond what we need to read. */
const MAX_XML_BYTES = 80 * 1024 * 1024;
/** Rows read per sheet. Enough for real paperwork, bounded for memory and the DOM. */
export const MAX_SHEET_ROWS = 5_000;
/** Characters per page when a text has no page breaks of its own. */
export const PAGE_CHARS = 3_000;

type Parts = Record<string, string>;

function unzipXml(bytes: Uint8Array): Result<Parts, InvalidInputReason> {
  let total = 0;
  let tooLarge = false;
  try {
    const files = unzipSync(bytes, {
      filter: (f) => {
        if (!/\.(xml|rels)$/i.test(f.name)) return false;
        total += f.originalSize;
        if (total > MAX_XML_BYTES) tooLarge = true;
        return !tooLarge;
      },
    });
    if (tooLarge) return err("too_large");
    const parts: Parts = {};
    for (const [name, data] of Object.entries(files)) parts[name] = strFromU8(data);
    return ok(parts);
  } catch {
    return err("unreadable");
  }
}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== "#") return ENTITIES[code] ?? whole;
    const n = code[1] === "x" || code[1] === "X" ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  });
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m?.[1] !== undefined ? decodeXml(m[1]) : null;
}

/** Relationship id → part path, from a `.rels` part. Targets are relative to `baseDir`. */
function relationships(parts: Parts, relsPath: string, baseDir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const tag of parts[relsPath]?.match(/<Relationship\b[^>]*>/g) ?? []) {
    const id = attr(tag, "Id");
    const target = attr(tag, "Target");
    if (id && target) out.set(id, resolvePath(baseDir, target));
  }
  return out;
}

function resolvePath(baseDir: string, target: string): string {
  const segments = target.startsWith("/") ? [] : baseDir.split("/").filter(Boolean);
  for (const s of target.split("/")) {
    if (s === "..") segments.pop();
    else if (s && s !== ".") segments.push(s);
  }
  return segments.join("/");
}

/** Splits long text into pages at paragraph breaks, about `size` characters each. */
export function chunkText(text: string, size = PAGE_CHARS): string[] {
  const pages: string[] = [];
  let current = "";
  for (const para of text.split(/(?<=\n)/)) {
    if (current.length > 0 && current.length + para.length > size) {
      pages.push(current);
      current = "";
    }
    current += para;
    while (current.length > size * 2) {
      pages.push(current.slice(0, size));
      current = current.slice(size);
    }
  }
  if (current.trim() || pages.length === 0) pages.push(current);
  return pages;
}

const clean = (pages: string[]) =>
  pages.map((p) =>
    p
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );

/** Word: one entry per page, split where Word itself broke the pages when it last saved the file. */
export function readDocx(bytes: Uint8Array): Result<string[], InvalidInputReason> {
  const parts = unzipXml(bytes);
  if (!parts.ok) return parts;
  const xml = parts.value["word/document.xml"];
  if (xml === undefined) return err("unsupported_type");

  const pages: string[] = [];
  let page = "";
  const breakPage = () => {
    if (page.trim()) pages.push(page);
    page = "";
  };
  const token =
    /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\b([^>]*)\/>|<w:lastRenderedPageBreak\/>|<\/?w:tc\b[^>]*>|<\/w:p>|<\/w:tr>/g;
  let inCell = false;
  for (const m of xml.matchAll(token)) {
    const tag = m[0];
    if (m[1] !== undefined) page += decodeXml(m[1]);
    else if (tag === "<w:tab/>") page += "\t";
    else if (tag.startsWith("<w:br")) {
      if (/w:type="page"/.test(m[2] ?? "")) breakPage();
      else page += "\n";
    } else if (tag === "<w:lastRenderedPageBreak/>") breakPage();
    else if (tag.startsWith("<w:tc")) inCell = true;
    else if (tag === "</w:tc>") {
      inCell = false;
      page = `${page.trimEnd()}\t`; // cells of a row on one line
    } else if (tag === "</w:p>" && inCell) page += " ";
    else page += "\n"; // end of a paragraph or a table row
  }
  breakPage();
  // No page breaks recorded (e.g. made by Google Docs): split long text so citations stay precise.
  const out = pages.length === 1 ? chunkText(pages[0] ?? "") : pages;
  return ok(clean(out));
}

/** Column letters of a cell reference ("BC12") → 0-based index. */
function columnIndex(ref: string): number {
  let n = 0;
  for (const c of ref.match(/^[A-Z]+/)?.[0] ?? "") n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

const runText = (xml: string) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => decodeXml(m[1] ?? "")).join("");

/** Excel: every sheet in workbook order, as rows of cell text (shared strings resolved). */
export function readXlsx(bytes: Uint8Array): Result<Sheet[], InvalidInputReason> {
  const parts = unzipXml(bytes);
  if (!parts.ok) return parts;
  const p = parts.value;
  const workbook = p["xl/workbook.xml"];
  if (workbook === undefined) return err("unsupported_type");

  const shared = (p["xl/sharedStrings.xml"]?.match(/<si>[\s\S]*?<\/si>/g) ?? []).map(runText);
  const rels = relationships(p, "xl/_rels/workbook.xml.rels", "xl");
  const sheets: Sheet[] = [];
  for (const tag of workbook.match(/<sheet\b[^>]*>/g) ?? []) {
    const path = rels.get(attr(tag, "r:id") ?? "");
    const xml = path ? p[path] : undefined;
    if (xml === undefined) continue;
    const rows: string[][] = [];
    for (const row of xml.match(/<row\b[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g) ?? []) {
      if (rows.length >= MAX_SHEET_ROWS) break;
      const cells: string[] = [];
      for (const c of row.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
        const open = c.match(/^<c\b[^>]*/)?.[0] ?? "";
        const ref = attr(open, "r");
        const type = attr(open, "t");
        const v = c.match(/<v>([^<]*)<\/v>/)?.[1];
        let text = "";
        if (type === "s") text = shared[Number(v)] ?? "";
        else if (type === "inlineStr") text = runText(c);
        else if (type === "b") text = v === "1" ? "TRUE" : "FALSE";
        else if (v !== undefined) text = decodeXml(v);
        const at = ref ? columnIndex(ref) : cells.length;
        if (at >= 0 && at < 1_000) cells[at] = text;
      }
      const filled = Array.from(cells, (x) => x ?? "");
      if (filled.some((x) => x.trim())) rows.push(filled);
    }
    sheets.push({ name: attr(tag, "name") ?? `Sheet ${sheets.length + 1}`, rows });
  }
  return sheets.length > 0 ? ok(sheets) : err("unreadable");
}

export function sheetText(sheet: Sheet): string {
  const rows = sheet.rows.map((r) => r.filter((c) => c.trim()).join(" | "));
  return [sheet.name, ...rows].join("\n");
}

/** PowerPoint: every slide in presentation order, with its title and the rest of its text. */
export function readPptx(bytes: Uint8Array): Result<Slide[], InvalidInputReason> {
  const parts = unzipXml(bytes);
  if (!parts.ok) return parts;
  const p = parts.value;
  const presentation = p["ppt/presentation.xml"];
  if (presentation === undefined) return err("unsupported_type");

  const rels = relationships(p, "ppt/_rels/presentation.xml.rels", "ppt");
  const slides: Slide[] = [];
  for (const tag of presentation.match(/<p:sldId\b[^>]*>/g) ?? []) {
    const path = rels.get(attr(tag, "r:id") ?? "");
    const xml = path ? p[path] : undefined;
    if (xml === undefined) continue;
    const paragraphs = (shape: string) =>
      (shape.match(/<a:p>[\s\S]*?<\/a:p>|<a:p\s[\s\S]*?<\/a:p>/g) ?? [])
        .map((para) => [...para.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1] ?? "")).join(""))
        .filter((line) => line.trim());
    const titleShape = (xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? []).find((s) =>
      /<p:ph\b[^>]*type="(?:title|ctrTitle)"/.test(s),
    );
    const title = titleShape ? paragraphs(titleShape).join(" ") : "";
    const lines = paragraphs(titleShape ? xml.replace(titleShape, "") : xml);
    slides.push({ title, lines });
  }
  return slides.length > 0 ? ok(slides) : err("unreadable");
}

export function slideText(slide: Slide): string {
  return [slide.title, ...slide.lines].filter(Boolean).join("\n");
}
