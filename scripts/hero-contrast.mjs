/**
 * Worst-frame text contrast over the live hero orb (docs/HERO.md: 4.5:1 or better, measured at the worst frame).
 * For each hero text element: hide its text, grab 12 frames of the pixels behind it while the orb runs, take the
 * brightest pixel, and compute the contrast ratio with the text's real color. Uses the machine's real GPU.
 *   BASE=http://localhost:3102 node scripts/hero-contrast.mjs [width]
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3102";
const width = Number(process.argv[2] ?? 1440);
const FRAMES = 12;

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu"],
});
const page = await (
  await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 } })
).newPage();
await page.goto(`${BASE}/en`);
await page.waitForSelector('[data-testid="hero-orb"]:not([data-tier="static"]) canvas', { timeout: 60_000 });

const targets = {
  eyebrow: "section.hero-stage .eyebrow",
  "sub copy": "section.hero-stage #hero-title + p",
  "trust list": "section.hero-stage ul li",
  "explainer link": '[data-testid="explainer-open"]',
};

const luminance = ([r, g, b]) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

let worstOverall = Number.POSITIVE_INFINITY;
for (const [name, selector] of Object.entries(targets)) {
  const el = page.locator(selector).first();
  const color = await el.evaluate((node) => {
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = getComputedStyle(node).color;
    c.fillRect(0, 0, 1, 1);
    return [...c.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  });
  await el.evaluate((node) => {
    for (const n of [node, ...node.querySelectorAll("*")])
      n.style.setProperty("color", "transparent", "important");
  });
  await page.waitForTimeout(600); // buttons transition their color; wait until the text is really gone
  // The rectangle of the text itself, not the pill, border or dot around it.
  const box = await el.evaluate((node) => {
    const range = document.createRange();
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let first = null;
    let last = null;
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (t.textContent?.trim()) {
        first ??= t;
        last = t;
      }
    }
    if (!(first && last)) return null;
    range.setStartBefore(first);
    range.setEndAfter(last);
    const r = range.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  if (!box) throw new Error(`${name} not found`);
  let brightest = 0;
  for (let i = 0; i < FRAMES; i++) {
    const png = await page.screenshot({ clip: box });
    const lum = await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)); // fetch(data:) is blocked by the CSP
      const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const c = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d");
      c.drawImage(bmp, 0, 0);
      const d = c.getImageData(0, 0, bmp.width, bmp.height).data;
      let max = 0;
      for (let p = 0; p < d.length; p += 4)
        max = Math.max(max, d[p] * 0.2126 + d[p + 1] * 0.7152 + d[p + 2] * 0.0722);
      return max;
    }, png.toString("base64"));
    brightest = Math.max(brightest, lum);
  }
  const bg = luminance([brightest, brightest, brightest]);
  const text = luminance(color);
  const ratio = (Math.max(text, bg) + 0.05) / (Math.min(text, bg) + 0.05);
  worstOverall = Math.min(worstOverall, ratio);
  console.log(
    `${name}: text rgb(${color}) on brightest bg gray ${brightest.toFixed(0)} -> ${ratio.toFixed(2)}:1`,
  );
}
console.log(
  `width ${width}: worst ratio ${worstOverall.toFixed(2)}:1 (${worstOverall >= 4.5 ? "pass" : "FAIL"} at 4.5:1)`,
);
await browser.close();
process.exit(worstOverall >= 4.5 ? 0 : 1);
