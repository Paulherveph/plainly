"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Analysis, OutputLocale, PartialAnalysis } from "../domain/analysis";

export type ReuseReason = "duplicate" | "sample" | "translated";

export type AnalysisState =
  | { status: "streaming"; partial: PartialAnalysis | null; credits: number | null }
  | { status: "ready"; analysis: Analysis; dropped: number; reason?: ReuseReason }
  | { status: "not_official" }
  | {
      status: "error";
      error: string;
      detail?: Record<string, number | string>;
      /** B13: what had streamed before the failure, shown as incomplete with a Resume action. */
      partial: PartialAnalysis | null;
    };

type Line =
  | { type: "start"; credits: number }
  | { type: "partial"; data: PartialAnalysis }
  | { type: "final"; data: Analysis; dropped: number; reason?: ReuseReason }
  | { type: "notice"; notice: "not_official" | "running" }
  | { type: "error"; error: string; detail?: Record<string, number | string> };

const POLL_MS = 3_000;

/**
 * Reads the NDJSON stream from /api/analysis. Starts once per mount (also under StrictMode).
 * Leaving the page does not stop the job on the server; it is stored and shown on return.
 */
export function useAnalysisStream(
  documentId: string,
  locale: OutputLocale,
  initial: { analysis: Analysis; dropped: number } | null,
) {
  const [state, setState] = useState<AnalysisState>(
    initial ? { status: "ready", ...initial } : { status: "streaming", partial: null, credits: null },
  );
  const started = useRef(Boolean(initial));
  const alive = useRef(true);
  const lastPartial = useRef<PartialAnalysis | null>(null);

  const run = useCallback(
    async (mode: "auto" | "general" = "auto") => {
      setState({ status: "streaming", partial: lastPartial.current, credits: null });
      try {
        const res = await fetch("/api/analysis", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ documentId, locale, mode }),
        });
        if (!res.body) throw new Error("no body");
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        let settled = false;
        let credits: number | null = null;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const raw of lines) {
            if (!raw.trim() || !alive.current) continue;
            const line = JSON.parse(raw) as Line;
            if (line.type === "start") {
              credits = line.credits;
              setState({ status: "streaming", partial: null, credits });
            } else if (line.type === "partial") {
              lastPartial.current = line.data;
              setState({ status: "streaming", partial: line.data, credits });
            } else if (line.type === "final") {
              settled = true;
              lastPartial.current = null;
              setState({ status: "ready", analysis: line.data, dropped: line.dropped, reason: line.reason });
            } else if (line.type === "notice") {
              settled = true;
              if (line.notice === "not_official") setState({ status: "not_official" });
              // Already running (another tab, or we came back): check again shortly.
              else setTimeout(() => alive.current && void run(mode), POLL_MS);
            } else {
              settled = true;
              setState({ status: "error", error: line.error, detail: line.detail, partial: lastPartial.current });
            }
          }
        }
        if (!settled && alive.current)
          setState({ status: "error", error: "ai_failed", partial: lastPartial.current });
      } catch {
        if (alive.current) setState({ status: "error", error: "ai_failed", partial: lastPartial.current });
      }
    },
    [documentId, locale],
  );

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

  return { state, retry: () => run("auto"), continueAsGeneral: () => run("general") };
}
