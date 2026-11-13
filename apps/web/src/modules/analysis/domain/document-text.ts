import type { OutputLocale } from "./analysis";

export const LANGUAGE_NAMES: Record<OutputLocale, string> = {
  en: "English",
  fr: "French",
  zh: "Simplified Chinese",
};

/** Document text is data: closing tags inside it are broken so it cannot end the delimiter. */
export const escapeTags = (text: string): string =>
  text.replaceAll("</document>", "</ document>").replaceAll("</page>", "</ page>");

/** Page-marked document text inside delimiters. Pages are 1-based, matching cite.page. */
export function documentText(pages: readonly string[]): string {
  const body = pages.map((p, i) => `<page number="${i + 1}">\n${escapeTags(p)}\n</page>`).join("\n");
  return `<document>\n${body}\n</document>`;
}
