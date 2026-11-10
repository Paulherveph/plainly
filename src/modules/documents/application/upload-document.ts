import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import { storagePath, validatePageCount, validatePastedText, validateUpload } from "../domain/document";
import type {
  DocumentRepository,
  FileStore,
  SampleId,
  SampleLibrary,
  StoredFile,
  TextExtractor,
} from "./ports";

type Deps = {
  documents: DocumentRepository;
  files: FileStore;
  extractor: TextExtractor;
  samples: SampleLibrary;
  newId: () => string;
};

export type UploadCommand =
  | { userId: string; source: "file"; title: string; bytes: Uint8Array; mediaType: string }
  | { userId: string; source: "text"; title: string; text: string }
  | { userId: string; source: "sample"; sampleId: SampleId };

/** Validate, extract page text, store privately, record. Returns the new document id. */
export function makeUploadDocument(deps: Deps) {
  return async function uploadDocument(cmd: UploadCommand): Promise<Result<{ id: string }, AppError>> {
    const input = await resolveInput(cmd, deps.samples);
    if (!input.ok) return input;
    const { title, file } = input.value;

    const extracted = await deps.extractor.extract(file);
    if (!extracted.ok) return err({ kind: "invalid_input", reason: extracted.error });
    const pages = validatePageCount(extracted.value.pageCount);
    if (!pages.ok) return err({ kind: "invalid_input", reason: pages.error });

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
      pageCount: pages.value,
      pages: extracted.value.pages,
    });
    return created.ok ? ok({ id }) : created;
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
      const type = validateUpload({ mediaType: cmd.mediaType, size: cmd.bytes.byteLength });
      if (!type.ok) return err({ kind: "invalid_input", reason: type.error });
      return ok({ title: cmd.title, file: { bytes: cmd.bytes, mediaType: type.value } });
    }
  }
}
