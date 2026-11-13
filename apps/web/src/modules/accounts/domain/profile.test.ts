import { describe, expect, it } from "vitest";
import { confirmsDeletion, ProfilePatch, rehomePath } from "./profile";

describe("profile rules", () => {
  it("E10: accepts language and theme, rejects others", () => {
    expect(ProfilePatch.parse({ locale: "fr", theme: "dark" })).toEqual({ locale: "fr", theme: "dark" });
    expect(ProfilePatch.safeParse({ locale: "de" }).success).toBe(false);
    expect(ProfilePatch.parse({ displayName: "   " })).toEqual({ displayName: null });
  });

  it("E12: deletion needs the exact confirmation word", () => {
    expect(confirmsDeletion(" DELETE ", "delete")).toBe(true);
    expect(confirmsDeletion("delet", "delete")).toBe(false);
    expect(confirmsDeletion("", "")).toBe(false);
  });

  it("E06: moves storage paths from the guest folder to the member folder only", () => {
    expect(rehomePath("g1/d1/original.pdf", "g1", "u1")).toBe("u1/d1/original.pdf");
    expect(rehomePath("other/d1/original.pdf", "g1", "u1")).toBeNull();
  });
});
