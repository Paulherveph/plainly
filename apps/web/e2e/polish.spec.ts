import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("the tab shows the Plainly icon and the app is installable", async ({ page, request }) => {
  await page.goto("/en");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /icon\.svg/);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Plainly", display: "standalone" });
  expect((await request.get("/icons/icon-512.png")).ok()).toBe(true);
});

test("the theme toggle is a bordered button that switches the theme", async ({ page }) => {
  await page.goto("/en");
  const toggle = page.getByTestId("theme-toggle");
  await expect(toggle).toHaveAccessibleName("Switch to light theme");
  const border = await toggle.evaluate((el) => Number.parseFloat(getComputedStyle(el).borderTopWidth));
  expect(border).toBeGreaterThan(0);
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await expect(toggle).toHaveAccessibleName("Switch to dark theme");
});

test("the install section explains how to install on mobile", async ({ page, isMobile }) => {
  await page.goto("/en");
  await page.locator("#install").scrollIntoViewIfNeeded();
  await page.getByTestId("install-mobile").click();
  const dialog = page.getByRole("dialog", { name: "How to install Plainly" });
  await expect(dialog).toBeVisible();
  // On a desktop browser it gives the address to open on the phone; on Android, the steps.
  await expect(dialog).toContainText(isMobile ? "Tap Install app." : "Open this address on your phone");
});

test("the landing videos are lazy and the steps follow the video", async ({ page }) => {
  await page.goto("/en");
  const clip = page.locator('video[poster="/videos/steps.webp"]');
  await expect(clip).toHaveAttribute("preload", /none|auto/);
  await expect(clip).toHaveJSProperty("muted", true);
  const act = page.getByRole("button", { name: /03\s*Act/ });
  await act.scrollIntoViewIfNeeded();
  await act.click();
  await expect(act).toHaveAttribute("aria-pressed", "true");
});

test("a video whose WebM fails to decode falls back to the MP4 and plays", async ({ page }) => {
  // Real header (metadata loads), scrambled frames: the browser fails with MEDIA_ERR_DECODE,
  // like a GPU that can't decode VP9.
  const webm = readFileSync("public/videos/steps.webm");
  for (let i = 8192; i < webm.length; i += 7) webm.writeUInt8(webm.readUInt8(i) ^ 0x5a, i);
  await page.route("**/videos/steps.webm", (r) => r.fulfill({ body: webm, contentType: "video/webm" }));

  await page.goto("/en");
  const steps = page.locator('video[poster="/videos/steps.webp"]');
  await steps.scrollIntoViewIfNeeded();
  await expect.poll(() => steps.evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(/\/steps\.mp4$/);
  await expect.poll(() => steps.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.5);
});

test("navigating shows the page skeleton before the data arrives", async ({ page, isMobile }) => {
  test.skip(isMobile, "the nav links are in the menu on mobile; one viewport is enough");
  let stall = false;
  await page.route("**/*", async (route) => {
    const h = route.request().headers();
    if (stall && h.rsc && !h["next-router-prefetch"] && !h["next-router-segment-prefetch"]) {
      await new Promise((r) => setTimeout(r, 2500));
    }
    await route.continue().catch(() => {});
  });
  await page.goto("/en/privacy");
  await page.waitForLoadState("networkidle");
  stall = true;
  await page.locator("header nav").getByRole("link", { name: "Deadlines" }).click();
  await expect(page.getByTestId("skeleton").first()).toBeVisible();
  stall = false;
  await expect(page.getByRole("heading", { name: "Deadlines", level: 1 })).toBeVisible();
});
