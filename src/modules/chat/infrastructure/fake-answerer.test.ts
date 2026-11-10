import { describe, expect, it } from "vitest";
import { groundAnswer } from "../domain/grounding";
import { FakeAnswerer, findBestSentence } from "./fake-answerer";

const PAGES = [
  "§2 Rent. The monthly rent is €850, payable on or before the 5th day of each month.",
  "§9 Pets. No animals may be kept in the premises without the prior written consent of the Landlord.",
];

async function ask(question: string) {
  const run = new FakeAnswerer(0).answer({ pages: PAGES, question });
  for await (const _ of run.partials) {
    // drain
  }
  const draft = await run.final;
  return draft.ok ? groundAnswer(draft.value, PAGES) : null;
}

describe("FakeAnswerer + grounding", () => {
  it("answers from the document with a verified quote", async () => {
    const res = await ask("Can I keep animals?");
    expect(res?.kind).toBe("answer");
    expect(res?.kind === "answer" && res.citations[0]?.page).toBe(2);
  });

  it("refuses when the document doesn't say: I can't find that in this document", async () => {
    expect(await ask("Is parking included?")).toEqual({ kind: "refusal" });
  });

  it("matches on meaningful words only", () => {
    expect(findBestSentence(PAGES, "what is the")).toBeNull();
    expect(findBestSentence(PAGES, "When is the rent due?")?.page).toBe(1);
  });
});
