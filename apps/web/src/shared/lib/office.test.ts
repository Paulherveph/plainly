import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { chunkText, decodeXml, readDocx, readPptx, readXlsx, sheetText, slideText } from "./office";

const zip = (files: Record<string, string>) =>
  zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

const run = (text: string) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;

describe("readDocx", () => {
  it("keeps Word's page breaks, tabs, table cells and entities", () => {
    const body = [
      `<w:p>${run("Rent &amp; deposit")}<w:r><w:tab/></w:r>${run("1 200 €")}</w:p>`,
      `<w:tbl><w:tr><w:tc><w:p>${run("Start")}</w:p></w:tc><w:tc><w:p>${run("1 March")}</w:p></w:tc></w:tr></w:tbl>`,
      `<w:p><w:r><w:lastRenderedPageBreak/></w:r>${run("Page two")}</w:p>`,
      `<w:p><w:r><w:br w:type="page"/></w:r>${run("Page three")}</w:p>`,
    ].join("");
    const pages = readDocx(zip({ "word/document.xml": `<w:document><w:body>${body}</w:body></w:document>` }));
    expect(pages.ok && pages.value).toEqual([
      "Rent & deposit\t1 200 €\nStart\t1 March",
      "Page two",
      "Page three",
    ]);
  });

  it("splits long text without page breaks into pages", () => {
    const paras = Array.from(
      { length: 40 },
      (_, i) => `<w:p>${run(`Paragraph ${i} ${"x".repeat(200)}`)}</w:p>`,
    );
    const pages = readDocx(zip({ "word/document.xml": `<w:body>${paras.join("")}</w:body>` }));
    expect(pages.ok && pages.value.length).toBeGreaterThan(2);
  });

  it("rejects a ZIP that is not a Word file, and bytes that are not a ZIP", () => {
    expect(readDocx(zip({ "a.xml": "<x/>" }))).toEqual({ ok: false, error: "unsupported_type" });
    expect(readDocx(new Uint8Array([1, 2, 3]))).toEqual({ ok: false, error: "unreadable" });
  });
});

describe("readXlsx", () => {
  it("reads sheets in workbook order with shared, inline and number cells in their columns", () => {
    const file = zip({
      "xl/workbook.xml": `<workbook><sheets><sheet name="Budget" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>`,
      "xl/sharedStrings.xml": `<sst><si><t>Item</t></si><si><r><t>Ren</t></r><r><t>t</t></r></si></sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>Due</t></is></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" s="1"/><c r="C2"><v>950</v></c></row></sheetData></worksheet>`,
      "xl/worksheets/sheet2.xml": `<worksheet><sheetData><row r="1"><c r="A1" t="b"><v>1</v></c></row></sheetData></worksheet>`,
    });
    const sheets = readXlsx(file);
    expect(sheets.ok && sheets.value).toEqual([
      {
        name: "Budget",
        rows: [
          ["Item", "", "Due"],
          ["Rent", "", "950"],
        ],
      },
      { name: "Notes", rows: [["TRUE"]] },
    ]);
    if (sheets.ok)
      expect(sheetText(sheets.value[0] ?? { name: "", rows: [] })).toBe("Budget\nItem | Due\nRent | 950");
  });
});

describe("readPptx", () => {
  it("reads slides in presentation order and finds each title", () => {
    const slide = (title: string, body: string) =>
      `<p:sld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:txBody><a:p><a:pPr lvl="1"/><a:r><a:t>${body}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:sld>`;
    const file = zip({
      "ppt/presentation.xml": `<p:presentation><p:sldIdLst><p:sldId id="257" r:id="rId3"/><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`,
      "ppt/_rels/presentation.xml.rels": `<Relationships><Relationship Id="rId2" Target="slides/slide1.xml"/><Relationship Id="rId3" Target="slides/slide2.xml"/></Relationships>`,
      "ppt/slides/slide1.xml": slide("Second", "Body two"),
      "ppt/slides/slide2.xml": slide("First", "Body one"),
    });
    const slides = readPptx(file);
    expect(slides.ok && slides.value).toEqual([
      { title: "First", lines: ["Body one"] },
      { title: "Second", lines: ["Body two"] },
    ]);
    if (slides.ok) expect(slideText(slides.value[0] ?? { title: "", lines: [] })).toBe("First\nBody one");
  });
});

describe("helpers", () => {
  it("decodes XML entities", () => {
    expect(decodeXml("a &lt;b&gt; &#233;&#x4E2D; &bogus;")).toBe("a <b> é中 &bogus;");
  });
  it("chunks text at paragraph breaks", () => {
    const pages = chunkText("aaaa\nbbbb\ncccc\n", 10);
    expect(pages).toEqual(["aaaa\nbbbb\n", "cccc\n"]);
  });
});
