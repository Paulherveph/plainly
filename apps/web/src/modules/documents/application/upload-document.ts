import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import {
  normalizeForHash,
  RETENTION_DAYS,
  storagePath,
  validatePageCount,
  validatePastedText,
  validateUpload,
} from "../domain/document";
import type {
  DocumentRepository,
  FileStore,
  Hasher,
  SampleId,
  SampleLibrary,
  StoredFile,
  TextExtractor,
} from "./ports";

/** Plan limits for this user, resolved by the caller (entitlements). Defaults are the Free plan. */
export type UploadLimits = { maxPages: number; maxBytes: number; retentionDays: number };

type Deps = {
  documents: DocumentRepository;
  files: FileStore;
  extractor: TextExtractor;
  samples: SampleLibrary;
  hasher: Hasher;
  newId: () => string;
  /** Checks plan limits before anything is stored (S4 entitlements). */
  checkLimits?: (input: { userId: string; pages: number; bytes: number }) => Promise<Result<UploadLimits, AppError>>;
};

export type UploadCommand =
  | { userId: string; source: "file"; title: string; bytes: Uint8Array; mediaType: string }
  | { userId: string; source: "text"; title: string; text: string }
  | { userId: string; source: "sample"; sampleId: SampleId };

/**
 * Validate (type by magic bytes, size, pages, text length), extract page text and flag scanned
 * pages, hash the content for the analysis cache, store privately, record. 0 tokens.
 */
export function makeUploadDocument(deps: Deps) {
  return async function uploadDocument(cmd: UploadCommand): Promise<Result<{ id: string }, AppError>> {
    const input = await resolveInput(cmd, deps.samples);
    if (!input.ok) return input;
    const { title, file } = input.value;

    const extracted = await deps.extractor.extract(file);
    if (!extracted.ok) return err({ kind: "invalid_input", reason: extracted.error });
    const pageCount = validatePageCount(extracted.value.pageCount);
    if (!pageCount.ok) return err({ kind: "invalid_input", reason: pageCount.error });

    // Samples are free and fixed; everything else is checked against the plan.
    let retentionDays = RETENTION_DAYS;
    if (cmd.source !== "sample" && deps.checkLimits) {
      const limits = await deps.checkLimits({ userId: cmd.userId, pages: pageCount.value, bytes: file.bytes.byteLength });
      if (!limits.ok) return limits;
      retentionDays = limits.value.retentionDays;
    }

    const { pages, visionPages } = extracted.value;
    const contentHash = pages
      ? await deps.hasher.sha256(normalizeForHash(pages))
      : await deps.hasher.sha256(file.bytes);

    const id = deps.newId();
    const path = storagePath(cmd.userId, id, file.mediaType);
    const stored = await deps.files.put(path, file);
    if (!stored.ok) return stored;

    const created = await deps.documents.create({
      id,
      userId: cmd.userId,
      title,
      mediaType: file.mediaType,
      storagePath: path,
      pageCount: pageCount.value,
      pages,
      visionPages,
      contentHash,
      sampleId: cmd.source === "sample" ? cmd.sampleId : null,
      retentionDays,
    });
    if (!created.ok) {
      // No orphan files (A07, A18): the row failed, so the object goes too.
      await deps.files.remove([path]);
      return created;
    }
    return ok({ id });
  };
}

async function resolveInput(
  cmd: UploadCommand,
  samples: SampleLibrary,
): Promise<Result<{ title: string; file: StoredFile }, AppError>> {
  switch (cmd.source) {
    case "sample":
      return samples.load(cmd.sampleId);
    case "text": {
      const text = validatePastedText(cmd.text);
      if (!text.ok) return err({ kind: "invalid_input", reason: text.error });
      return ok({
        title: cmd.title,
        file: { bytes: new TextEncoder().encode(text.value), mediaType: "text/plain" },
      });
    }
    case "file": {
      const type = validateUpload({
        mediaType: cmd.mediaType,
        size: cmd.bytes.byteLength,
        head: cmd.bytes.subarray(0, 8),
      });
      if (!type.ok) return err({ kind: "invalid_input", reason: type.error });
      return ok({ title: cmd.title, file: { bytes: cmd.bytes, mediaType: type.value } });
    }
  }
}
