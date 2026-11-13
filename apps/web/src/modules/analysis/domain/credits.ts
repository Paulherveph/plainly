/**
 * Credit cost of an analysis (TOKEN_ECONOMY section 5). Kept here so the analysis use case can
 * quote a cost before any model call; the full credit table lives in billing/credits.config.ts.
 */
export function analysisCredits(pageCount: number, visionPageCount: number): number {
  const pages = Math.max(1, pageCount);
  return 1 + 2 * Math.ceil(pages / 5) + (visionPageCount > 0 ? 2 * Math.ceil(visionPageCount / 5) : 0);
}

/** Bump when the analysis prompt or schema changes: cached results then stop matching (B20). */
export const ANALYSIS_VERSION = "a3";
