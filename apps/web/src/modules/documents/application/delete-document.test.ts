import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/shared/lib/result";
import { makeDeleteDocument } from "./delete-document";
import type { DocumentRepository, FileStore } from "./ports";

describe("deleteDocument (G02)", () => {
  it("deletes the row (children cascade) and then the original file", async () => {
    const documents = { deleteOwned: vi.fn(async () => ok({ storagePath: "u1/d1/original.pdf" })) };
    const files = { remove: vi.fn(async () => ok(null)) };
    const del = makeDeleteDocument({
      documents: documents as unknown as DocumentRepository,
      files: files as unknown as FileStore,
    });
    expect(await del("u1", "d1")).toEqual(ok(null));
    expect(files.remove).toHaveBeenCalledWith(["u1/d1/original.pdf"]);
  });

  it("touches no file when the document is not the user's", async () => {
    const documents = { deleteOwned: vi.fn(async () => err({ kind: "not_found" as const })) };
    const files = { remove: vi.fn() };
    const del = makeDeleteDocument({
      documents: documents as unknown as DocumentRepository,
      files: files as unknown as FileStore,
    });
    expect(await del("u2", "d1")).toEqual(err({ kind: "not_found" }));
    expect(files.remove).not.toHaveBeenCalled();
  });
});
