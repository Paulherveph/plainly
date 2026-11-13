import { describe, expect, it } from "vitest";
import { signValue, verifyValue } from "./signed-value";

const SECRET = "x".repeat(32);

describe("signed values (guest merge cookie)", () => {
  it("round-trips before expiry", async () => {
    const token = await signValue("guest-id", SECRET, 600);
    expect(await verifyValue(token, SECRET)).toBe("guest-id");
  });

  it("rejects tampering, another secret and expired tokens", async () => {
    const token = await signValue("guest-id", SECRET, 600);
    const [p, s] = token.split(".");
    expect(await verifyValue(`${p}x.${s}`, SECRET)).toBeNull();
    expect(await verifyValue(token, "y".repeat(32))).toBeNull();
    const old = await signValue("guest-id", SECRET, 60, Date.now() - 120_000);
    expect(await verifyValue(old, SECRET)).toBeNull();
  });
});
