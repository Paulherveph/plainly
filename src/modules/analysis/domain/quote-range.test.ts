import { describe, expect, it } from "vitest";
import { findQuoteRange, reflowPage } from "./quote-range";

const PAGE =
  "§9 Pets. No animals may be kept without the prior written consent of\nthe Land-\nlord. Tenant’s duties.";

function slice(page: string, quote: string) {
  const r = findQuoteRange(page, quote);
  return r ? page.slice(r.start, r.end) : null;
}

describe("findQuoteRange", () => {
  it("finds a quote across a line break", () => {
    expect(slice(PAGE, "prior written consent of the")).toBe("prior written consent of\nthe");
  });
  it("finds a quote across a hyphenated line break", () => {
    expect(slice(PAGE, "the Landlord")).toBe("the Land-\nlord");
  });
  it("is case-insensitive and apostrophe-tolerant", () => {
    expect(slice(PAGE, "tenant's duties")).toBe("Tenant’s duties");
  });
  it("escapes regex characters and returns null when absent", () => {
    expect(slice("Price (€850) per month", "(€850)")).toBe("(€850)");
    expect(findQuoteRange(PAGE, "parking included")).toBeNull();
    expect(findQuoteRange(PAGE, "   ")).toBeNull();
  });
});

describe("reflowPage", () => {
  it("joins mid-sentence breaks but keeps headings, clauses and sentence ends", () => {
    const raw =
      "RESIDENTIAL LEASE\nThis is made between A (the\nTenant) and B.\n§1 Term. Runs for a period of\ntwelve months.\n§2 Rent. The Land-\nlord gets paid.";
    expect(reflowPage(raw)).toBe(
      "RESIDENTIAL LEASE\nThis is made between A (the Tenant) and B.\n§1 Term. Runs for a period of twelve months.\n§2 Rent. The Landlord gets paid.",
    );
  });
});
