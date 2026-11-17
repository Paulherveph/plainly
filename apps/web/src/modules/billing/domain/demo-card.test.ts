import { describe, expect, it } from "vitest";
import {
  brandOf,
  cardFaceNumber,
  formatExpiry,
  formatNumber,
  luhn,
  TEST_CARDS,
  testCardOutcome,
  validateCard,
} from "./demo-card";

const TODAY = { year: 2026, month: 11 };
const GOOD = { number: "4242 4242 4242 4242", name: "Sam Taylor", expiry: "12/29", cvc: "123" };

describe("demo card", () => {
  it("formats numbers and expiry as people type", () => {
    expect(formatNumber("42424242424242429999")).toBe("4242 4242 4242 4242");
    expect(formatNumber("4242 42")).toBe("4242 42");
    expect(formatNumber("378282246310005")).toBe("3782 822463 10005");
    expect(formatExpiry("1229")).toBe("12/29");
    expect(formatExpiry("1")).toBe("1");
  });

  it("detects the brand from the first digits", () => {
    expect(brandOf("4242")).toBe("visa");
    expect(brandOf("5555")).toBe("mastercard");
    expect(brandOf("2221")).toBe("mastercard");
    expect(brandOf("3782")).toBe("amex");
    expect(brandOf("6011")).toBe("card");
  });

  it("shows typed digits on the card and dots for the rest, or only dots when hidden", () => {
    expect(cardFaceNumber("", false)).toBe("•••• •••• •••• ••••");
    expect(cardFaceNumber("424242", false)).toBe("4242 42•• •••• ••••");
    expect(cardFaceNumber("4242424242424242", true)).toBe("•••• •••• •••• ••••");
  });

  it("checks the Luhn digit", () => {
    expect(luhn(TEST_CARDS.approve)).toBe(true);
    expect(luhn(TEST_CARDS.decline)).toBe(true);
    expect(luhn("4242424242424241")).toBe(false);
  });

  it("validates every field", () => {
    expect(validateCard(GOOD, TODAY)).toEqual({});
    expect(validateCard({ number: "", name: " ", expiry: "", cvc: "" }, TODAY)).toEqual({
      number: "required",
      name: "required",
      expiry: "required",
      cvc: "required",
    });
    expect(
      validateCard({ ...GOOD, number: "4242 4242 4242 4241", expiry: "13/29", cvc: "12" }, TODAY),
    ).toEqual({
      number: "invalid",
      expiry: "invalid",
      cvc: "invalid",
    });
    expect(validateCard({ ...GOOD, expiry: "10/26" }, TODAY)).toEqual({ expiry: "expired" });
    expect(validateCard({ ...GOOD, expiry: "11/26" }, TODAY)).toEqual({});
  });

  it("only accepts the published test cards", () => {
    expect(testCardOutcome("4242 4242 4242 4242")).toBe("approve");
    expect(testCardOutcome("4000000000000002")).toBe("decline");
    expect(testCardOutcome("5555555555554444")).toBe("not_test_card");
  });
});
