"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Analysis, OutputLocale, PartialAnalysis } from "../domain/analysis";

export type AnalysisState =
  | { status: "streaming"; partial: PartialAnalysis | null }
  | { status: "ready"; analysis: Analysis; dropped: number }
  | { status: "error"; error: string };

type Line =
  | { type: "partial"; data: PartialAnalysis }
  | { type: "final"; data: Analysis; dropped: number }
  | { type: "error"; error: string };

/** Reads the NDJSON stream from /api/analysis. Starts once per mount (also under StrictMode). */
export function useAnalysisStream(
  documentId: string,
  locale: OutputLocale,
  initial: { analysis: Analysis; dropped: number } | null,
) {
  const [state, setState] = useState<AnalysisState>(
    initial ? { status: "ready", ...initial } : { status: "streaming", partial: null },
  );
  const started = useRef(Boolean(initial));
  const alive = useRef(true);

  const run = useCallback(async () => {
    setState({ status: "streaming", partial: null });
    try {
      const res = await fetch("/api/analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId, locale }),
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let settled = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          if (!raw.trim() || !alive.current) continue;
          const line = JSON.parse(raw) as Line;
          if (line.type === "partial") setState({ status: "streaming", partial: line.data });
          else if (line.type === "final") {
            settled = true;
            setState({ status: "ready", analysis: line.data, dropped: line.dropped });
          } else {
            settled = true;
            setState({ status: "error", error: line.error });
          }
        }
      }
      if (!settled && alive.current) setState({ status: "error", error: "ai_failed" });
    } catch {
      if (alive.current) setState({ status: "error", error: "ai_failed" });
    }
  }, [documentId, locale]);

  useEffect(() => {
    alive.current = true;
    if (!started.current) {
      started.current = true;
      void run();
    }
    return () => {
      alive.current = false;
    };
  }, [run]);

  return { state, retry: run };
}
