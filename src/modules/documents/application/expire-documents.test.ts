import { describe, expect, it, vi } from "vitest";
import { ok } from "@/shared/lib/result";
import { makeExpireDocuments } from "./expire-documents";
import type { ExpiredDocuments, FileStore } from "./ports";

describe("expireDocuments", () => {
  it("removes files before rows and reports the count", async () => {
    const calls: string[] = [];
    let served = false;
    const expired: ExpiredDocuments = {
      listExpired: vi.fn(async () => {
        if (served) return ok([]);
        served = true;
        return ok([
          { id: "a", storagePath: "u/a/original.pdf" },
          { id: "b", storagePath: "u/b/original.png" },
        ]);
      }),
      deleteByIds: vi.fn(async (ids) => {
        calls.push(`rows:${ids.join(",")}`);
        return ok(null);
      }),
    };
    const files = {
      remove: vi.fn(async (paths: readonly string[]) => {
        calls.push(`files:${paths.length}`);
        return ok(null);
      }),
    } as unknown as FileStore;
    const res = await makeExpireDocuments({ expired, files, now: () => new Date("2026-12-11T00:00:00Z") })();
    expect(res).toEqual({ ok: true, value: { deleted: 2 } });
    expect(calls).toEqual(["files:2", "rows:a,b"]);
  });
});
