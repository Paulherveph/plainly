import { expect, type Page, test } from "@playwright/test";

/** Headless Chromium reports SwiftShader, which the page rejects on purpose. Tests that need the live orb report a GPU name. */
async function pretendToHaveAGpu(page: Page) {
  await page.addInitScript(() => {
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (p: number) {
      return p === 0x9246 ? "ANGLE (Test GPU)" : getParameter.call(this, p);
    };
  });
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

test.describe("hero", () => {
  test.skip(({ isMobile }) => isMobile, "hero geometry is measured on the desktop project");

  // H05
  test("reduced motion shows the static orb and draws nothing", async ({ page }) => {
    const errors = collectErrors(page);
    await pretendToHaveAGpu(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en");
    await expect(page.getByTestId("hero-static")).toBeVisible();
    await expect(page.getByTestId("hero-static-image")).toBeVisible({ timeout: 15_000 }); // the decision comes 3 s after load, then at idle
    await expect(page.getByTestId("hero-orb")).toHaveAttribute("data-tier", "static");
    await expect(page.locator("canvas")).toHaveCount(0);
    // Scroll must not drive anything either: the calm variable is never set.
    await page.mouse.wheel(0, 600);
    expect(
      await page.locator("section.hero-stage").evaluate((el) => el.style.getPropertyValue("--calm")),
    ).toBe("");
    expect(errors).toEqual([]);
  });

  // H05
  test("without WebGL the static orb shows and nothing throws", async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
    await page.goto("/en");
    await expect(page.getByTestId("hero-static-image")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("hero-orb")).toHaveAttribute("data-tier", "static");
    expect(errors).toEqual([]);
  });

  // H06
  for (const width of [1440, 1920, 2560]) {
    test(`at ${width}px the orb is at least 30% of the width and the headline stays clear`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1200 });
      await page.goto("/en");
      const orb = await page.getByTestId("hero-orb").boundingBox();
      const h1 = await page.getByRole("heading", { level: 1 }).boundingBox();
      const preview = await page.getByRole("figure", { name: /Example analysis/ }).boundingBox();
      if (!(orb && h1 && preview)) throw new Error("hero parts not found");
      expect(orb.width).toBeGreaterThanOrEqual(width * 0.3);
      expect(orb.y).toBeGreaterThanOrEqual(h1.y + h1.height); // orb starts below the headline
      expect(preview.y).toBeGreaterThanOrEqual(h1.y + h1.height); // preview never covers it
      const content = await page.getByRole("heading", { level: 1 }).locator("xpath=..").boundingBox();
      expect(content?.width).toBeLessThanOrEqual(1440);
    });
  }

  test("the page does not shift while the orb loads and has no console errors", async ({ page }) => {
    const errors = collectErrors(page);
    await pretendToHaveAGpu(page);
    await page.addInitScript(() => {
      (window as unknown as { cls: number }).cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
          if (!e.hadRecentInput) (window as unknown as { cls: number }).cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/en");
    await expect(page.getByTestId("hero-orb")).not.toHaveAttribute("data-tier", "static", {
      timeout: 30_000,
    });
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as { cls: number }).cls)).toBeLessThanOrEqual(0.05);
    expect(errors).toEqual([]);
  });

  test("on a 4x slower CPU the orb steps down until frames are under 22 ms", async ({ page }) => {
    test.setTimeout(120_000);
    await pretendToHaveAGpu(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/en");
    await expect(page.getByTestId("hero-orb")).not.toHaveAttribute("data-tier", "static", {
      timeout: 30_000,
    });
    const medianFrameMs = () =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const deltas: number[] = [];
            let last = performance.now();
            const tick = (now: number) => {
              deltas.push(now - last);
              last = now;
              if (deltas.length < 40) requestAnimationFrame(tick);
              else resolve([...deltas].sort((a, b) => a - b)[20] ?? 0);
            };
            requestAnimationFrame(tick);
          }),
      );
    await expect.poll(medianFrameMs, { timeout: 90_000, intervals: [500] }).toBeLessThan(22);
  });
});
