import { z } from "zod";

export const LOCALES = ["en", "fr", "zh"] as const;
export type OutputLocale = (typeof LOCALES)[number];

export const Cite = z.object({
  page: z.number().int().positive().nullable(),
  quote: z.string().max(240),
});
export type Cite = z.infer<typeof Cite>;

/** The validated, verified analysis we store and show (PRD 7.3). */
export const Analysis = z.object({
  documentType: z.string(),
  language: z.enum(["en", "fr", "zh", "other"]),
  summary: z.string().max(600),
  keyFacts: z.array(z.object({ label: z.string(), value: z.string(), cite: Cite })),
  actions: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      dueOn: z.iso.date().nullable(),
      /** A relative or unclear deadline as written ("within 30 days of receipt"). */
      dueRule: z.string().max(200).nullable().default(null),
      /** The date could be read two ways (03/04/2026). Never guessed: dueOn stays null. */
      dateAmbiguous: z.boolean().default(false),
      cite: Cite,
    }),
  ),
  watchOuts: z.array(
    z.object({
      severity: z.enum(["info", "caution", "critical"]),
      title: z.string(),
      explanation: z.string(),
      cite: Cite,
    }),
  ),
  glossary: z.array(z.object({ term: z.string(), plain: z.string() })),
});
export type Analysis = z.infer<typeof Analysis>;

/** Output caps (TOKEN_ECONOMY section 3, technique 8). */
export const CAPS = { keyFacts: 8, actions: 8, watchOuts: 6, glossary: 6 } as const;
export type Severity = Analysis["watchOuts"][number]["severity"];

/**
 * What we ask the model for. Same shape, but lenient on lengths and dates so one
 * long sentence or a malformed date doesn't fail the whole run. `toAnalysis` tightens it.
 */
export const AnalysisDraft = z.object({
  documentType: z.string().describe("Short document type in the output language, e.g. 'Lease'"),
  language: z.enum(["en", "fr", "zh", "other"]).describe("Language the document itself is written in"),
  summary: z.string().describe("3 to 4 plain sentences, under 600 characters"),
  keyFacts: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        cite: z.object({ page: z.number().nullable(), quote: z.string() }),
      }),
    )
    .describe(`At most ${CAPS.keyFacts}`),
  actions: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        dueOn: z.string().nullable().describe("YYYY-MM-DD only if the document states the date, else null"),
        dueRule: z
          .string()
          .nullable()
          .optional()
          .describe("A relative or unclear deadline exactly as the document states it, else null"),
        dateAmbiguous: z
          .boolean()
          .optional()
          .describe("true if the written date could be read two ways, e.g. 03/04/2026"),
        cite: z.object({ page: z.number().nullable(), quote: z.string() }),
      }),
    )
    .describe(`At most ${CAPS.actions}`),
  watchOuts: z
    .array(
      z.object({
        severity: z.enum(["info", "caution", "critical"]),
        title: z.string(),
        explanation: z.string(),
        cite: z.object({ page: z.number().nullable(), quote: z.string() }),
      }),
    )
    .describe(`At most ${CAPS.watchOuts}`),
  glossary: z.array(z.object({ term: z.string(), plain: z.string() })).describe(`At most ${CAPS.glossary}`),
});
export type AnalysisDraft = z.infer<typeof AnalysisDraft>;

/** Deep partial, as streamed before the model finishes. */
export type PartialAnalysis = {
  documentType?: string;
  language?: string;
  summary?: string;
  keyFacts?: Array<Partial<AnalysisDraft["keyFacts"][number]> | undefined>;
  actions?: Array<Partial<AnalysisDraft["actions"][number]> | undefined>;
  watchOuts?: Array<Partial<AnalysisDraft["watchOuts"][number]> | undefined>;
  glossary?: Array<Partial<AnalysisDraft["glossary"][number]> | undefined>;
};

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, caution: 1, info: 2 };

function clamp(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function isoDateOrNull(value: string | null): string | null {
  if (!value) return null;
  return z.iso.date().safeParse(value).success ? value : null;
}

/** Tighten a draft into the stored shape: clamp lengths, drop bad dates, sort watch-outs. Citations untouched. */
export function toAnalysis(draft: AnalysisDraft): Analysis {
  const cite = (c: { page: number | null; quote: string }): Cite => ({
    page: c.page !== null && Number.isInteger(c.page) && c.page > 0 ? c.page : null,
    quote: c.quote.trim().slice(0, 240),
  });
  return Analysis.parse({
    documentType: clamp(draft.documentType, 60),
    language: draft.language,
    summary: clamp(draft.summary, 600),
    keyFacts: draft.keyFacts.slice(0, CAPS.keyFacts).map((f) => ({
      label: f.label.trim(),
      value: f.value.trim(),
      cite: cite(f.cite),
    })),
    actions: draft.actions.slice(0, CAPS.actions).map((a) => {
      const ambiguous = a.dateAmbiguous === true;
      const rule = a.dueRule?.trim() || null;
      return {
        title: a.title.trim(),
        detail: a.detail.trim(),
        // B04: an ambiguous date is never guessed. B03: a relative rule is kept as written.
        dueOn: ambiguous ? null : isoDateOrNull(a.dueOn),
        dueRule: rule ? clamp(rule, 200) : ambiguous && a.dueOn ? clamp(a.dueOn, 200) : null,
        dateAmbiguous: ambiguous,
        cite: cite(a.cite),
      };
    }),
    watchOuts: [...draft.watchOuts]
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      .slice(0, CAPS.watchOuts)
      .map((w) => ({ ...w, title: w.title.trim(), explanation: w.explanation.trim(), cite: cite(w.cite) })),
    glossary: draft.glossary
      .slice(0, CAPS.glossary)
      .map((g) => ({ term: g.term.trim(), plain: g.plain.trim() })),
  });
}
