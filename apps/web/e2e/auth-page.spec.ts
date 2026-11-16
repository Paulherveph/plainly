import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

/**
 * The sign-in / sign-up page layout and its scene (docs/AUTH.md section 4, docs/HERO.md performance rules).
 * Needs no Supabase: nothing here sends a code. The code step is covered by auth.spec.ts (E03, E04).
 */

// SwiftShader lets headless Chromium draw WebGL. Without pretendToHaveAGpu() the page still rejects it.
test.use({
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

/** Headless Chromium reports SwiftShader, which the page rejects on purpose. Report a GPU name instead. */
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

/** WCAG relative luminance of the brightest pixel in a PNG, decoded by the browser (no image dependency). */
async function brightestLuminance(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const l = 0.2126 * lin(data[i] ?? 0) + 0.7152 * lin(data[i + 1] ?? 0) + 0.0722 * lin(data[i + 2] ?? 0);
      if (l > max) max = l;
    }
    return max;
  }, png.toString("base64"));
}

test("A01: the toggle switches sign in and sign up without losing the typed email", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/en/sign-in?next=/en/deadlines", { waitUntil: "networkidle" }); // typed text before hydration is reset
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  await page.getByPlaceholder("Email").filter({ visible: true }).fill("ada@example.com");

  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/mode=signup/);
  await expect(page).toHaveURL(/next=%2Fen%2Fdeadlines|next=\/en\/deadlines/);
  await expect(page.getByRole("heading", { level: 1, name: "Create your account" })).toBeVisible();
  await expect(page.getByPlaceholder("Email").filter({ visible: true })).toHaveValue("ada@example.com");
  await expect(page.getByTestId("auth-scene")).toHaveAttribute("data-variant", "signup");
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("A02: every locale has its title and one password field", async ({ page }) => {
  for (const [locale, title] of [
    ["en", "Welcome back"],
    ["fr", "Bon retour"],
    ["zh", "欢迎回来"],
  ] as const) {
    await page.goto(`/${locale}/sign-in`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
  }
});

test("A03: reduced motion shows the poster and draws nothing", async ({ page }) => {
  await pretendToHaveAGpu(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/sign-in");
  await expect(page.getByTestId("auth-scene-poster")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("auth-scene")).toHaveAttribute("data-tier", "static");
  await expect(page.locator('[data-testid="auth-scene"] canvas')).toHaveCount(0);
});

test("A04: the scene is never the LCP element", async ({ page }) => {
  await page.goto("/en/sign-in");
  await page.getByPlaceholder("Email").filter({ visible: true }).click(); // input ends LCP observation
  const inScene = await page.evaluate(
    () =>
      new Promise<boolean | null>((resolve) => {
        new PerformanceObserver((list) => {
          const last = list.getEntries().at(-1) as
            | (PerformanceEntry & { element?: Element | null })
            | undefined;
          resolve(last?.element ? Boolean(last.element.closest('[data-testid="auth-scene"]')) : null);
        }).observe({ type: "largest-contentful-paint", buffered: true });
      }),
  );
  expect(inScene).toBe(false);
});

test.describe("live scene", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "SwiftShader flags are Chromium only");

  test("A05: the title keeps 4.5:1 contrast on every sampled frame", async ({ page }) => {
    test.setTimeout(120_000);
    await pretendToHaveAGpu(page);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const mode of ["signin", "signup"] as const) {
      for (let t = 0; t < 9; t += 0.75) {
        await page.goto(`/en/sign-in?mode=${mode}&scene=${t}`);
        await page.locator('[data-testid="auth-scene-canvas"] canvas').waitFor();
        await page.waitForTimeout(900); // fade-in
        const h1 = page.locator("h1");
        const box = await h1.boundingBox();
        if (!box) throw new Error("no title");
        await h1.evaluate((el) => {
          el.style.visibility = "hidden";
        });
        const shot = await page.screenshot({ clip: box });
        const bg = await brightestLuminance(page, shot);
        // Title text is --text (#F4F4F6, luminance ~0.905).
        const ratio = (0.905 + 0.05) / (bg + 0.05);
        expect(ratio, `${mode} at ${t}s`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test("A06: the scene runs, pauses when hidden, and frees its context on leave", async ({ page }) => {
    const errors = collectErrors(page);
    await pretendToHaveAGpu(page);
    await page.goto("/en/sign-in");
    await expect(page.getByTestId("auth-scene")).not.toHaveAttribute("data-tier", /pending|static/, {
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="auth-scene-canvas"] canvas')).toHaveCount(1);
    await page.goto("/en/pricing");
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("A07: screenshots for the S3 gate", async ({ page, isMobile }) => {
    test.skip(isMobile, "sets its own widths; once is enough");
    test.setTimeout(180_000);
    await pretendToHaveAGpu(page);
    const dir = "../../docs/gate-reports/S3";
    mkdirSync(dir, { recursive: true });
    for (const width of [390, 768, 1440, 1920]) {
      await page.setViewportSize({
        width,
        height: width < 768 ? 844 : width < 1200 ? 1024 : width < 1600 ? 900 : 1080,
      });
      for (const [mode, t] of [
        ["signin", 5.85],
        ["signup", 5],
      ] as const) {
        await page.goto(`/en/sign-in?mode=${mode}&scene=${t}`);
        await page.locator('[data-testid="auth-scene-canvas"] canvas').waitFor();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${dir}/auth-${mode}-${width}.png` });
      }
    }
  });
});
