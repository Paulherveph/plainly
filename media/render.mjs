/**
 * Renders a video from media/videos/<name>.html, frame by frame, through its seek(t) clock.
 *
 *   node media/render.mjs <name> [--fps 30] [--stills] [--theme light] [--social] [--vertical]
 *                             [--audio track.mp3] [--query scene=x] [--as output-name]
 *   node media/render.mjs --serve            # preview every video at http://localhost:4600
 *
 * Site renders (default): 1280 px wide MP4 (H.264) + WebM (VP9) + WebP poster in public/videos/.
 * --social: full-size 1080p master in media/out/ (with --audio muxed in, if given).
 * --stills: one PNG per beat in media/out/stills/<name>/ to check pacing before a full render.
 */
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = new URL(".", import.meta.url).pathname; // media/
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function serve(port = 0) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^\/+/, "");
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};

if (flag("serve")) {
  const server = await serve(4600);
  console.log(`Preview: http://localhost:${server.address().port}/videos/  (open a .html file)`);
} else {
  const valued = new Set(["--fps", "--theme", "--audio", "--query", "--as"]);
  const name = args.find((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
  if (!name)
    throw new Error("usage: node media/render.mjs <name> [--fps 30] [--stills] [--theme light] [--social]");
  await render(name);
}

function ffmpeg(argv) {
  const p = spawn("ffmpeg", ["-loglevel", "error", "-y", ...argv], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((ok, ko) =>
    p.on("close", (c) => (c === 0 ? ok() : ko(new Error(`ffmpeg exited ${c}`)))),
  );
  return { stdin: p.stdin, done };
}

async function render(name) {
  const fps = Number(opt("fps", 30));
  const theme = opt("theme", "dark");
  const social = flag("social");
  const suffix = theme === "light" ? "-light" : "";
  const server = await serve();
  const query = opt("query", "");
  const url = `http://localhost:${server.address().port}/videos/${name}.html?render&theme=${theme}${args.includes("--vertical") ? "&vertical" : ""}${query ? `&${query}` : ""}`;
  const outName = opt("as", name);

  const browser = await chromium.launch();
  const probe = await browser.newPage();
  await probe.goto(url);
  await probe.waitForFunction(() => window.VIDEO);
  const meta = await probe.evaluate(() => window.VIDEO);
  await probe.close();

  const page = await browser.newPage({ viewport: { width: meta.width, height: meta.height } });
  await page.goto(url);
  await page.waitForFunction(() => window.VIDEO);
  await page.evaluate(() => document.fonts.ready);
  // Make sure every screenshot is decoded before the first frame.
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  const at = async (t) => {
    await page.evaluate((s) => window.seek(s), t);
    await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : i.decode()))));
  };

  const vertical = args.includes("--vertical") ? "-vertical" : "";
  if (flag("stills")) {
    const dir = join(ROOT, "out/stills", outName + suffix + vertical);
    mkdirSync(dir, { recursive: true });
    const beats = meta.beats.length ? meta.beats : [0, meta.duration / 2];
    for (const [i, t] of beats.entries()) {
      await at(t);
      await page.screenshot({ path: join(dir, `${String(i + 1).padStart(2, "0")}-${t.toFixed(2)}s.png`) });
    }
    console.log(`stills → ${dir}`);
  } else {
    const outDir = social ? join(ROOT, "out") : join(ROOT, "../public/videos");
    mkdirSync(outDir, { recursive: true });
    const base = join(outDir, outName + suffix + vertical);
    // Site renders cap the long side at 1280 px (never upscale small loops).
    const scale = social
      ? []
      : [
          "-vf",
          meta.width >= meta.height
            ? "scale=w='min(1280,iw)':h=-2:flags=lanczos"
            : "scale=w=-2:h='min(1280,ih)':flags=lanczos",
        ];
    const audio = opt("audio");
    const input = ["-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-"];
    const enc = ffmpeg([
      ...input,
      ...(audio ? ["-i", audio, "-shortest", "-c:a", "aac", "-b:a", "192k"] : []),
      ...scale,
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      social ? "18" : "26",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      `${base}.mp4`,
    ]);
    const frames = Math.round(meta.duration * fps);
    for (let f = 0; f < frames; f++) {
      await at(f / fps);
      const buf = await page.screenshot({ type: "jpeg", quality: 92 });
      if (!enc.stdin.write(buf)) await new Promise((ok) => enc.stdin.once("drain", ok));
      if (f % fps === 0)
        process.stdout.write(`\r${name}${suffix}${vertical} ${Math.round((f / frames) * 100)}%`);
    }
    enc.stdin.end();
    await enc.done;
    if (!social) {
      // WebM from the MP4 (same frames), then the poster.
      await ffmpeg([
        "-i",
        `${base}.mp4`,
        "-c:v",
        "libvpx-vp9",
        "-crf",
        "38",
        "-b:v",
        "0",
        "-row-mt",
        "1",
        "-an",
        `${base}.webm`,
      ]).done;
      await at(meta.poster);
      const png = join(ROOT, "out", `${outName}${suffix}${vertical}-poster.png`);
      mkdirSync(join(ROOT, "out"), { recursive: true });
      await page.screenshot({ path: png });
      await ffmpeg(["-i", png, ...scale, "-quality", "82", `${base}.webp`]).done;
    }
    console.log(`\r${name}${suffix}${vertical} → ${base}.{mp4${social ? "" : ",webm,webp"}}`);
  }
  await browser.close();
  server.close();
}
