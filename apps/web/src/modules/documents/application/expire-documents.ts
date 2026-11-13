import type { AppError } from "@/shared/lib/errors";
import { log } from "@/shared/lib/log";
import { ok, type Result } from "@/shared/lib/result";
import type { ExpiredDocuments, FileStore } from "./ports";

const BATCH = 200;

/** 30-day retention: removes files first, then rows (children cascade). Runs daily. */
export function makeExpireDocuments(deps: { expired: ExpiredDocuments; files: FileStore; now: () => Date }) {
  return async function expireDocuments(): Promise<Result<{ deleted: number }, AppError>> {
    let deleted = 0;
    for (let round = 0; round < 50; round++) {
      const batch = await deps.expired.listExpired(deps.now(), BATCH);
      if (!batch.ok) return batch;
      if (batch.value.length === 0) break;
      const files = await deps.files.remove(batch.value.map((d) => d.storagePath));
      if (!files.ok) return files;
      const rows = await deps.expired.deleteByIds(batch.value.map((d) => d.id));
      if (!rows.ok) return rows;
      deleted += batch.value.length;
      if (batch.value.length < BATCH) break;
    }
    log("retention.expired", { deleted });
    return ok({ deleted });
  };
}
