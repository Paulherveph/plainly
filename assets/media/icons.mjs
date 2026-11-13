// Renders the brand icon to the PNG sizes the browser and the PWA manifest need.
// Usage: node media/icons.mjs
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync(new URL("../src/app/icon.svg", import.meta.url), "utf8");
const jobs = [
  { out: "src/app/apple-icon.png", size: 180, pad: 0.1, bg: "#0b0b0f" },
  { out: "public/icons/icon-192.png", size: 192, pad: 0, bg: "transparent" },
  { out: "public/icons/icon-512.png", size: 512, pad: 0, bg: "transparent" },
  // Maskable: the platform crops to a circle, so keep the mark inside the 80% safe zone.
  { out: "public/icons/maskable-512.png", size: 512, pad: 0.2, bg: "#0b0b0f" },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { out, size, pad, bg } of jobs) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${bg}">
       <div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div>
     </body>`,
  );
  await page.screenshot({ path: out, omitBackground: bg === "transparent" });
  console.log("wrote", out);
}
await browser.close();
