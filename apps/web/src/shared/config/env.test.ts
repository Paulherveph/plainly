import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src");
const ALLOWED = new Set([join(ROOT, "shared/config/env.ts")]);

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files;
}

describe("env access", () => {
  it("only src/shared/config/env.ts reads process.env", () => {
    const offenders = sourceFiles(ROOT).filter(
      (f) => !ALLOWED.has(f) && readFileSync(f, "utf8").includes("process.env"),
    );
    expect(offenders).toEqual([]);
  });
});
