"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { DOCX, type OfficeType, XLSX } from "@/modules/documents/domain/document";
import type { Sheet, Slide } from "@/shared/lib/office";

type Loaded = { kind: "sheets"; sheets: Sheet[] } | { kind: "slides"; slides: Slide[] } | { kind: "docx" };
export type PreviewState = "loading" | "ready" | "error";

/** Rows drawn per sheet. The extracted text (and the analysis) still covers every row read. */
const ROWS_SHOWN = 1_000;

async function load(src: string, mediaType: OfficeType, docxBox: () => HTMLElement | null): Promise<Loaded> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (mediaType === DOCX) {
    const { renderAsync } = await import("docx-preview");
    const box = docxBox();
    if (!box) throw new Error("no container");
    // Fonts are skipped: embedded fonts would load from blob: URLs, which the CSP blocks.
    await renderAsync(bytes, box, undefined, {
      inWrapper: true,
      ignoreFonts: true,
      breakPages: true,
      renderComments: false,
      renderChanges: false,
    });
    return { kind: "docx" };
  }
  const office = await import("@/shared/lib/office");
  if (mediaType === XLSX) {
    const sheets = office.readXlsx(bytes);
    if (!sheets.ok) throw new Error(sheets.error);
    return { kind: "sheets", sheets: sheets.value };
  }
  const slides = office.readPptx(bytes);
  if (!slides.ok) throw new Error(slides.error);
  return { kind: "slides", slides: slides.value };
}

/**
 * Word, Excel and PowerPoint files, drawn in the browser from the private original.
 * Word keeps its layout (docx-preview). Excel shows its cells. PowerPoint shows each slide's text.
 */
export function OfficePreview({
  src,
  mediaType,
  onState,
}: {
  src: string;
  mediaType: OfficeType;
  /** Must be stable (a state setter). */
  onState: (state: PreviewState) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const docxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    load(src, mediaType, () => docxRef.current).then(
      (value) => {
        if (cancelled) return;
        setLoaded(value);
        onState("ready");
      },
      () => {
        if (!cancelled) onState("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [src, mediaType, onState]);

  if (mediaType === DOCX) return <DocxPages boxRef={docxRef} ready={loaded !== null} />;
  if (loaded?.kind === "sheets") return <Sheets sheets={loaded.sheets} />;
  if (loaded?.kind === "slides") return <Slides slides={loaded.slides} />;
  return null;
}

/** Word pages are drawn at their real width, then scaled down to fit the panel. */
function DocxPages({ boxRef, ready }: { boxRef: React.RefObject<HTMLDivElement | null>; ready: boolean }) {
  const outerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const box = boxRef.current;
    if (!ready || !outer || !box) return;
    // docx-preview's own <style> is unlayered, so it beats Tailwind's layered utilities: set these inline.
    const wrapper = box.querySelector<HTMLElement>(".docx-wrapper");
    if (wrapper) Object.assign(wrapper.style, { background: "transparent", padding: "12px" });
    const fit = () => {
      const page = box.querySelector<HTMLElement>("section.docx");
      if (page) box.style.zoom = String(Math.min(1, (outer.clientWidth - 24) / page.offsetWidth));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [ready, boxRef]);

  return (
    <div ref={outerRef} className="size-full overflow-auto">
      <div
        ref={boxRef}
        className={cn("transition-opacity duration-200", ready ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}

function columnName(i: number): string {
  let name = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

const GRID_HEAD = "border-[#d4d4dc] border-r border-b bg-[#ececf1] px-2 py-1 font-medium text-[#5c5c68]";

function Sheets({ sheets }: { sheets: Sheet[] }) {
  const t = useTranslations("Analysis");
  const [active, setActive] = useState(0);
  const sheet = sheets[active] ?? sheets[0];
  if (!sheet) return null;
  const width = Math.max(1, ...sheet.rows.map((r) => r.length));
  const rows = sheet.rows.slice(0, ROWS_SHOWN);

  return (
    <div className="flex size-full flex-col">
      {sheets.length > 1 ? (
        <div
          role="tablist"
          aria-label={t("sheets")}
          className="flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-2"
        >
          {sheets.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className="shrink-0 rounded-md px-2.5 py-1 text-muted-foreground text-xs aria-selected:bg-surface-2 aria-selected:text-foreground aria-selected:shadow-[0_0_0_1px_var(--line-strong)]"
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-separate border-spacing-0 bg-paper text-[12px] text-paper-ink">
          <thead>
            <tr>
              <th className={cn(GRID_HEAD, "sticky top-0 left-0 z-20")} />
              {Array.from({ length: width }, (_, c) => (
                <th key={c} scope="col" className={cn(GRID_HEAD, "sticky top-0 z-10 min-w-20")}>
                  {columnName(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <th scope="row" className={cn(GRID_HEAD, "sticky left-0 text-right font-mono text-[11px]")}>
                  {r + 1}
                </th>
                {Array.from({ length: width }, (_, c) => (
                  <td
                    key={c}
                    title={row[c]}
                    className="max-w-64 truncate border-[#e4e4ea] border-r border-b px-2 py-1"
                  >
                    {row[c]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sheet.rows.length > ROWS_SHOWN ? (
          <p className="p-3 text-muted-foreground text-xs">{t("rowsShown", { count: ROWS_SHOWN })}</p>
        ) : null}
      </div>
    </div>
  );
}

function Slides({ slides }: { slides: Slide[] }) {
  const t = useTranslations("Analysis");
  return (
    <div className="flex size-full flex-col gap-4 overflow-auto p-4.5">
      <p className="text-muted-foreground text-xs">{t("slidesNote")}</p>
      {slides.map((slide, i) => (
        <article
          key={i}
          aria-label={t("slideOf", { slide: i + 1, total: slides.length })}
          className="relative flex aspect-video shrink-0 flex-col gap-2 rounded bg-paper px-6 pt-5 pb-8 text-paper-ink shadow-[0_10px_30px_-12px_rgb(0_0_0/0.5)]"
        >
          {slide.title ? <h3 className="font-semibold text-[15px] leading-snug">{slide.title}</h3> : null}
          <ul className="grid gap-1 text-[12px] leading-[1.5]">
            {slide.lines.map((line, j) => (
              <li key={j}>{line}</li>
            ))}
          </ul>
          <span className="absolute right-4.5 bottom-3 font-mono text-[10px] text-[#5c5c68]">
            {i + 1} / {slides.length}
          </span>
        </article>
      ))}
    </div>
  );
}
