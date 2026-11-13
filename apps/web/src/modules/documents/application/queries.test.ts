import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/shared/lib/result";
import type { Document } from "../domain/document";
import type { DocumentRepository, FileStore } from "./ports";
import { makeReadOriginal } from "./queries";

const doc = { id: "d1", userId: "u1", storagePath: "u1/d1/original.pdf" } as Document;
const file = { bytes: new Uint8Array([37, 80, 68, 70]), mediaType: "application/pdf" as const };

function setup(read: FileStore["read"] = async () => ok(file)) {
  const documents = {
    getOwned: vi.fn(async (userId: string, id: string) =>
      userId === doc.userId && id === doc.id ? ok(doc) : err({ kind: "not_found" as const }),
    ),
  } as unknown as DocumentRepository;
  const files = { read: vi.fn(read) } as unknown as FileStore;
  return { readOriginal: makeReadOriginal({ documents, files }), files };
}

describe("readOriginal", () => {
  it("returns the owner's file from its storage path", async () => {
    const { readOriginal, files } = setup();
    expect(await readOriginal("u1", "d1")).toEqual(ok(file));
    expect(files.read).toHaveBeenCalledWith("u1/d1/original.pdf");
  });

  it("does not read storage for someone else's document", async () => {
    const { readOriginal, files } = setup();
    expect(await readOriginal("u2", "d1")).toEqual(err({ kind: "not_found" }));
    expect(files.read).not.toHaveBeenCalled();
  });

  it("passes storage failures through", async () => {
    const { readOriginal } = setup(async () => err({ kind: "storage_failed" }));
    expect(await readOriginal("u1", "d1")).toEqual(err({ kind: "storage_failed" }));
  });
});
