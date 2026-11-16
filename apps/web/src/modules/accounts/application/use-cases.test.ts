import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/shared/lib/result";
import type { AccountAdmin } from "./ports";
import { makeDeleteAccount, makeExportData, makeMergeGuest } from "./use-cases";

function admin(overrides: Partial<AccountAdmin> = {}): AccountAdmin {
  return {
    isGuest: vi.fn(async () => true),
    storagePaths: vi.fn(async () => ok(["g/d1/original.pdf", "g/d2/original.pdf"])),
    moveFile: vi.fn(async () => ok(null)),
    mergeGuest: vi.fn(async () => ok(2)),
    removeUserFolder: vi.fn(async () => ok(null)),
    deleteUser: vi.fn(async () => ok(null)),
    ...overrides,
  };
}

describe("mergeGuest (E06)", () => {
  it("moves files into the member folder, then merges rows", async () => {
    const a = admin();
    expect(await makeMergeGuest({ admin: a })({ guestId: "g", userId: "u" })).toEqual(ok({ documents: 2 }));
    expect(a.moveFile).toHaveBeenCalledWith("g/d1/original.pdf", "u/d1/original.pdf");
    expect(a.mergeGuest).toHaveBeenCalledWith("g", "u");
  });

  it("refuses when the source is not a guest", async () => {
    const a = admin({ isGuest: vi.fn(async () => false) });
    expect(await makeMergeGuest({ admin: a })({ guestId: "g", userId: "u" })).toEqual(
      err({ kind: "not_found" }),
    );
    expect(a.mergeGuest).not.toHaveBeenCalled();
  });

  it("moves files back when the SQL merge fails", async () => {
    const a = admin({ mergeGuest: vi.fn(async () => err({ kind: "db_failed" as const })) });
    await makeMergeGuest({ admin: a })({ guestId: "g", userId: "u" });
    expect(a.moveFile).toHaveBeenCalledWith("u/d1/original.pdf", "g/d1/original.pdf");
  });
});

describe("exportData (E11)", () => {
  it("zips one JSON file per table and the originals", async () => {
    const zip = vi.fn((_entries: { path: string; bytes: Uint8Array }[]) => new Uint8Array([1]));
    const run = makeExportData({
      data: {
        tables: async () => ok({ documents: [{ id: "d1" }], messages: [] }),
        originals: async () => ok([{ path: "d1/original.pdf", bytes: new Uint8Array([2]) }]),
      },
      zipper: { zip },
    });
    expect((await run("u")).ok).toBe(true);
    expect(zip.mock.calls[0]?.[0].map((e) => e.path)).toEqual([
      "README.txt",
      "data/documents.json",
      "data/messages.json",
      "originals/d1/original.pdf",
    ]);
  });
});

describe("deleteAccount (E12)", () => {
  const notice = { subject: "s", text: "t" };

  it("cancels the subscription, removes files, deletes the user and sends a confirmation", async () => {
    const a = admin();
    const mailer = { send: vi.fn(async () => ok(null)) };
    const cancel = vi.fn(async () => ok(null));
    const res = await makeDeleteAccount({ admin: a, subscriptions: { cancelForDeletion: cancel }, mailer })({
      userId: "u",
      email: "a@b.c",
      typed: "delete",
      word: "delete",
      notice,
    });
    expect(res).toEqual(ok(null));
    expect(cancel).toHaveBeenCalledWith("u");
    expect(a.removeUserFolder).toHaveBeenCalledWith("u");
    expect(a.deleteUser).toHaveBeenCalledWith("u");
    expect(mailer.send).toHaveBeenCalled();
  });

  it("does nothing without the confirmation word", async () => {
    const a = admin();
    const res = await makeDeleteAccount({
      admin: a,
      subscriptions: { cancelForDeletion: async () => ok(null) },
      mailer: null,
    })({
      userId: "u",
      email: null,
      typed: "nope",
      word: "delete",
      notice,
    });
    expect(res.ok).toBe(false);
    expect(a.deleteUser).not.toHaveBeenCalled();
  });
});
