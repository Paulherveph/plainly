import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { SampleId, SampleLibrary, StoredFile } from "../application/ports";

const TITLES: Record<SampleId, string> = {
  lease: "Residential lease — 14 Rue des Lilas, Lyon",
  visa: "Residence permit renewal notice",
  offer: "Offer letter — Product Designer, Nordlys",
};

/** Built-in sample PDFs in /samples (bundled via outputFileTracingIncludes). */
export class FsSampleLibrary implements SampleLibrary {
  async load(id: SampleId): Promise<Result<{ title: string; file: StoredFile }, AppError>> {
    try {
      const bytes = await readFile(join(process.cwd(), "samples", `${id}.pdf`));
      return ok({ title: TITLES[id], file: { bytes: new Uint8Array(bytes), mediaType: "application/pdf" } });
    } catch {
      return err({ kind: "not_found" });
    }
  }
}
