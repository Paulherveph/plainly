/**
 * Frame times of the live hero orb under a CPU throttle (docs/HERO.md: "CPU throttled 4x ... median frame time
 * under 22 ms after the automatic quality step-down"). Uses the machine's real GPU.
 *   BASE=http://localhost:3102 node scripts/orb-frames.mjs [width] [throttle]
 * Prints the tier and the median frame time every 2 seconds for 30 seconds.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3102";
const width = Number(process.argv[2] ?? 1440);
const rate = Number(process.argv[3] ?? 4);

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu"],
});
const page = await (
  await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 } })
).newPage();
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate });
await page.goto(`${BASE}/en`);
await page.waitForSelector('[data-testid="hero-orb"]:not([data-tier="static"]) canvas', { timeout: 60_000 });
const started = Date.now();
console.log(`width ${width}, CPU x${rate}`);
while (Date.now() - started < 30_000) {
  const { median, tier } = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const deltas = [];
        let last = performance.now();
        const tick = (now) => {
          deltas.push(now - last);
          last = now;
          if (deltas.length < 40) requestAnimationFrame(tick);
          else
            resolve({
              median: [...deltas].sort((a, b) => a - b)[20],
              tier: document.querySelector('[data-testid="hero-orb"]')?.getAttribute("data-tier"),
            });
        };
        requestAnimationFrame(tick);
      }),
  );
  console.log(`${((Date.now() - started) / 1000).toFixed(0)}s tier=${tier} median=${median.toFixed(1)}ms`);
}
await browser.close();
