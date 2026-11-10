import { describe, expect, it } from "vitest";
import { installTarget } from "./install-target";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
  winEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0",
  firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
};

describe("installTarget", () => {
  it("detects iOS in any browser (all use WebKit and Add to Home Screen)", () => {
    expect(installTarget(UA.iphoneSafari)).toBe("ios");
    expect(installTarget(UA.iphoneChrome)).toBe("ios");
  });
  it("detects Android", () => expect(installTarget(UA.android)).toBe("android"));
  it("detects Chromium desktops (Chrome, Edge)", () => {
    expect(installTarget(UA.macChrome)).toBe("desktop-chromium");
    expect(installTarget(UA.winEdge)).toBe("desktop-chromium");
  });
  it("detects Safari on macOS", () => expect(installTarget(UA.macSafari)).toBe("desktop-safari"));
  it("falls back to other (Firefox desktop cannot install web apps)", () => {
    expect(installTarget(UA.firefox)).toBe("other");
    expect(installTarget("")).toBe("other");
  });
  it("treats an iPad that reports a Mac UA with touch as iOS", () => {
    expect(installTarget(UA.macSafari, { touchPoints: 5 })).toBe("ios");
  });
});
