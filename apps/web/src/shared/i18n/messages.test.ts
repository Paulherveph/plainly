import { describe, expect, it } from "vitest";
import en from "@messages/en.json";
import fr from "@messages/fr.json";
import zh from "@messages/zh.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function values(obj: object): string[] {
  return Object.values(obj).flatMap((v) => (typeof v === "object" && v !== null ? values(v) : [String(v)]));
}

describe("messages", () => {
  it("fr and zh have exactly the same keys as en", () => {
    const base = keys(en).sort();
    expect(keys(fr).sort()).toEqual(base);
    expect(keys(zh).sort()).toEqual(base);
  });

  it("has no empty strings", () => {
    for (const dict of [en, fr, zh]) {
      expect(values(dict).filter((v) => v.trim() === "")).toEqual([]);
    }
  });
});
