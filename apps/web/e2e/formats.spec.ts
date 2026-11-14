import { expect, type Page, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

/** Tiny but valid Office files, built here so no binary fixture lives in the repo. */
const zip = (files: Record<string, string>) =>
  Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))));

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const para = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

const DOCX = zip({
  "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`,
  "word/document.xml": `<?xml version="1.0"?><w:document ${W}><w:body>${para("Quote 2026-001 for the website.")}${para("Payment terms: 30% on order, 40% after the mockups, 30% on delivery.")}${para("This quote is valid for 15 days.")}</w:body></w:document>`,
});

const XLSX = zip({
  "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`,
  "xl/workbook.xml": `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}"><sheets><sheet name="Rent" sheetId="1" r:id="rId1"/><sheet name="Contacts" sheetId="2" r:id="rId2"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`,
  "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Month</t></is></c><c r="B1" t="inlineStr"><is><t>Rent due</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>March</t></is></c><c r="B2"><v>950</v></c></row></sheetData></worksheet>`,
  "xl/worksheets/sheet2.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Landlord office</t></is></c></row></sheetData></worksheet>`,
});

const slide = (title: string, body: string) =>
  `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:txBody><a:p><a:r><a:t>${body}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;

const PPTX = zip({
  "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`,
  "ppt/presentation.xml": `<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="${REL}"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst></p:presentation>`,
  "ppt/_rels/presentation.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="${REL}/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="${REL}/slide" Target="slides/slide2.xml"/></Relationships>`,
  "ppt/slides/slide1.xml": slide("Application file", "Deadline for documents: 30 November"),
  "ppt/slides/slide2.xml": slide("Fees", "The application fee is 120 euros"),
});

const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

async function upload(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto("/en/documents");
  const input = page.locator('input[type="file"]');
  await expect(input).toBeEnabled(); // enabled only once React has attached its handler
  await input.setInputFiles(file);
  await page.waitForURL(/\/en\/documents\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("analysis-status").filter({ visible: true })).toHaveText("Analysis ready", {
    timeout: 30_000,
  });
  return page.getByRole("complementary", { name: "Document preview" });
}

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, "the desktop aside is enough; the mobile sheet renders the same component");
});

test("A20: a Word file is analysed and previewed with its layout", async ({ page }) => {
  const preview = await upload(page, { name: "Quote.docx", mimeType: MIME.docx, buffer: DOCX });
  await expect(preview.locator(".docx-wrapper")).toContainText("Payment terms: 30% on order");
  await expect(preview.getByRole("link", { name: "Open original" })).toHaveAttribute("href", /\/original$/);
  await preview.getByRole("button", { name: "Show extracted text" }).click();
  await expect(preview.locator("article[data-page]").first()).toContainText("valid for 15 days");
});

test("A21: an Excel file is previewed as a grid, one tab per sheet", async ({ page }) => {
  // Some browsers send no type for Office files: the name decides, and the bytes are still checked.
  const preview = await upload(page, { name: "Budget.xlsx", mimeType: "", buffer: XLSX });
  await expect(preview.getByRole("cell", { name: "950" })).toBeVisible();
  await preview.getByRole("tab", { name: "Contacts" }).click();
  await expect(preview.getByRole("cell", { name: "Landlord office" })).toBeVisible();
});

test("A22: a PowerPoint file is previewed slide by slide, in deck order", async ({ page }) => {
  const preview = await upload(page, { name: "Application.pptx", mimeType: MIME.pptx, buffer: PPTX });
  await expect(preview.getByRole("article", { name: "Slide 1 of 2" })).toContainText(
    "Deadline for documents",
  );
  await expect(preview.getByRole("article", { name: "Slide 2 of 2" })).toContainText("120 euros");
});

test("A23: a Markdown file is read as text", async ({ page }) => {
  const text = "Residence permit renewal. Send the documents before 30 November. ".repeat(6);
  const preview = await upload(page, {
    name: "letter.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(text),
  });
  await expect(preview.locator("article[data-page]").first()).toContainText(
    "Send the documents before 30 November",
  );
});
