/**
 * The demo checkout's card logic. Pure, and it runs in the browser only: card details never reach the
 * server. Only the published test cards are accepted, so nobody can pay (or try to pay) with a real card.
 */

export type CardBrand = "visa" | "mastercard" | "amex" | "card";
export type CardField = "number" | "name" | "expiry" | "cvc";
export type CardInput = Record<CardField, string>;
export type CardErrors = Partial<Record<CardField, "required" | "invalid" | "expired">>;

export const TEST_CARDS = { approve: "4242424242424242", decline: "4000000000000002" } as const;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function brandOf(digits: string): CardBrand {
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  return "card";
}

function maxDigits(brand: CardBrand): number {
  return brand === "amex" ? 15 : 16;
}

/** Splits characters into the brand's groups: 4-4-4-4, or 4-6-5 for Amex. */
function group(chars: string, brand: CardBrand): string {
  const sizes = brand === "amex" ? [4, 6, 5] : [4, 4, 4, 4];
  const parts: string[] = [];
  let at = 0;
  for (const size of sizes) {
    if (at >= chars.length) break;
    parts.push(chars.slice(at, at + size));
    at += size;
  }
  return parts.join(" ");
}

/** "4242424242424242" -> "4242 4242 4242 4242". */
export function formatNumber(value: string): string {
  const digits = digitsOnly(value);
  const brand = brandOf(digits);
  return group(digits.slice(0, maxDigits(brand)), brand);
}

/** "1234" -> "12/34", typed digits only. */
export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** What the card face shows: typed digits, then dots for the rest. Hidden shows only dots. */
export function cardFaceNumber(value: string, hidden: boolean): string {
  const digits = digitsOnly(value);
  const brand = brandOf(digits);
  const shown = hidden ? "" : digits.slice(0, maxDigits(brand));
  return group(shown.padEnd(maxDigits(brand), "•"), brand);
}

export function luhn(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** `today` is the shopper's current year and month (1-12). */
export function validateCard(card: CardInput, today: { year: number; month: number }): CardErrors {
  const errors: CardErrors = {};
  const digits = digitsOnly(card.number);
  if (!digits) errors.number = "required";
  else if (digits.length !== maxDigits(brandOf(digits)) || !luhn(digits)) errors.number = "invalid";

  if (!card.name.trim()) errors.name = "required";

  const expiry = /^(\d{2})\/(\d{2})$/.exec(card.expiry);
  const month = Number(expiry?.[1]);
  const year = 2000 + Number(expiry?.[2]);
  if (!card.expiry) errors.expiry = "required";
  else if (!expiry || month < 1 || month > 12) errors.expiry = "invalid";
  else if (year * 12 + month < today.year * 12 + today.month) errors.expiry = "expired";

  const cvc = digitsOnly(card.cvc);
  if (!cvc) errors.cvc = "required";
  else if (cvc.length !== (brandOf(digits) === "amex" ? 4 : 3)) errors.cvc = "invalid";
  return errors;
}

export function testCardOutcome(number: string): "approve" | "decline" | "not_test_card" {
  const digits = digitsOnly(number);
  if (digits === TEST_CARDS.approve) return "approve";
  if (digits === TEST_CARDS.decline) return "decline";
  return "not_test_card";
}
