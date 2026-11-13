import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Analysis, type OutputLocale } from "@/modules/analysis/domain/analysis";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { SampleId, SampleLibrary, StoredFile } from "../application/ports";

const TITLES: Record<SampleId, string> = {
  lease: "Residential lease — 14 Rue des Lilas, Lyon",
  visa: "Residence permit renewal notice",
  offer: "Offer letter — Product Designer, Nordlys",
};

const root = () => join(process.cwd(), "samples");

/** Built-in sample PDFs in /samples (bundled via outputFileTracingIncludes). */
export class FsSampleLibrary implements SampleLibrary {
  async load(id: SampleId): Promise<Result<{ title: string; file: StoredFile }, AppError>> {
    try {
      const bytes = await readFile(join(root(), `${id}.pdf`));
      return ok({ title: TITLES[id], file: { bytes: new Uint8Array(bytes), mediaType: "application/pdf" } });
    } catch {
      return err({ kind: "not_found" });
    }
  }

  /**
   * Precomputed analysis (built once by `pnpm ai:samples`), so samples cost 0 tokens.
   * Null when the file has not been generated yet.
   */
  async analysis(id: SampleId, locale: OutputLocale): Promise<Analysis | null> {
    try {
      const raw = await readFile(join(root(), "analyses", `${id}.${locale}.json`), "utf8");
      const parsed = Analysis.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}
