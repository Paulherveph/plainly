/**
 * Plainly motion kit. Every frame is a pure function of time: a video defines render(t),
 * the renderer calls seek(t) once per frame. No CSS transitions, no timers inside visuals,
 * no state carried between frames, so any frame can be rendered, scrubbed or looped exactly.
 */

export const BRAND = "#9478FF";
export const BRAND_SOFT = "#C9BDFF";
export const INK = "#0B0B0F";
export const SURFACE = "#13131A";
export const TEXT = "#F4F4F6";
export const MUTED = "#9A9AA8";
export const OK = "#3DD68C";
export const CRITICAL = "#FF5C6C";

// ───────── math ─────────
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
/** 0→1 progress of t through [start, start + dur]. */
export const prog = (t, start, dur) => clamp((t - start) / dur);
/** Smooth window: rises over [a, a+fade], holds, falls over [b-fade, b]. */
export const win = (t, a, b, fade = 0.3) => Math.min(prog(t, a, fade), 1 - prog(t, b - fade, fade));

export const ease = {
  linear: (x) => x,
  out: (x) => 1 - (1 - x) ** 3,
  outQuart: (x) => 1 - (1 - x) ** 4,
  outExpo: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  in: (x) => x * x * x,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2),
};

/**
 * Closed-form damped spring, 0 at t<=0, settles at 1. A small overshoot by default.
 * The same function moves an element and draws its graph, so they always agree.
 */
export function spring(t, { freq = 1.6, damping = 0.5 } = {}) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const z = Math.min(damping, 0.999);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

/** Deterministic pseudo-random in [0,1) from an integer seed (for stable "noise"). */
export function rand(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ───────── DOM ─────────
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Create an element: h("div", { class: "x", style: "..." }, ...children). */
export function h(tag, attrs = {}, ...kids) {
  const svg = [
    "svg",
    "path",
    "circle",
    "rect",
    "line",
    "g",
    "polyline",
    "text",
    "defs",
    "linearGradient",
    "stop",
  ].includes(tag);
  const el = svg ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const k of kids.flat()) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}

/**
 * Apply a frame's visual state. Transform order is fixed (translate, rotate, scale) so values
 * never depend on what the previous frame set.
 */
export function set(
  el,
  { x = 0, y = 0, s = 1, sx, sy, r = 0, o, blur, clip, w, hgt, bg, color, extra } = {},
) {
  if (!el) return;
  const scale = sx != null || sy != null ? `scale(${sx ?? s}, ${sy ?? s})` : `scale(${s})`;
  el.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) ${scale}`;
  if (o != null) el.style.opacity = String(clamp(o));
  if (blur != null) el.style.filter = blur > 0.01 ? `blur(${blur}px)` : "none";
  if (clip != null) el.style.clipPath = clip;
  if (w != null) el.style.width = `${w}px`;
  if (hgt != null) el.style.height = `${hgt}px`;
  if (bg != null) el.style.background = bg;
  if (color != null) el.style.color = color;
  if (extra) Object.assign(el.style, extra);
}

/** Split text into per-letter spans (spaces kept). Returns the spans. */
export function letters(el, text) {
  el.textContent = "";
  return [...text].map((ch) => {
    const span = h("span", { class: "ch" }, ch === " " ? " " : ch);
    el.append(span);
    return span;
  });
}

/** Characters of `text` visible at progress p (typing). */
export const typed = (text, p) => text.slice(0, Math.round(text.length * clamp(p)));

// ───────── stage ─────────
/**
 * Registers a video. In ?render mode the renderer drives seek(t). Otherwise a small preview
 * harness plays it (space = play/pause, ←/→ = ±0.1 s, number keys jump to beats, drag = scrub).
 */
export function video({ width = 1920, height = 1080, duration, poster = duration / 2, beats = [], render }) {
  const params = new URLSearchParams(location.search);
  if (params.get("theme") === "light") document.documentElement.classList.add("light");
  const root = document.getElementById("stage");
  root.style.width = `${width}px`;
  root.style.height = `${height}px`;
  window.VIDEO = { width, height, duration, poster, beats };
  window.seek = (t) => render(clamp(t, 0, duration));
  render(0);

  if (params.has("render")) {
    document.documentElement.classList.add("render");
    return;
  }
  // Preview harness only: fit to window and play. Not part of any rendered frame.
  const fit = () => {
    const k = Math.min(innerWidth / width, (innerHeight - 40) / height);
    root.style.transform = `scale(${k})`;
  };
  fit();
  addEventListener("resize", fit);
  const bar = h("input", { type: "range", min: 0, max: duration, step: 0.01, value: 0, class: "scrub" });
  document.body.append(bar);
  let t = 0;
  let playing = true;
  let last = performance.now();
  const frame = (now) => {
    if (playing) t = (t + (now - last) / 1000) % duration;
    last = now;
    bar.value = String(t);
    render(t);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  bar.addEventListener("input", () => {
    t = Number(bar.value);
    playing = false;
  });
  addEventListener("keydown", (e) => {
    if (e.key === " ") playing = !playing;
    if (e.key === "ArrowRight") t = Math.min(duration, t + 0.1);
    if (e.key === "ArrowLeft") t = Math.max(0, t - 0.1);
    const n = Number(e.key);
    if (!Number.isNaN(n) && beats[n - 1] != null) {
      t = beats[n - 1];
      playing = false;
    }
  });
}

// ───────── shared pieces ─────────
/** macOS-style window with a screenshot inside. Returns { el, img, chrome }. */
export function appWindow({ src, width, url = "plainly.app", light = false }) {
  const img = h("img", { src, class: "win-img", alt: "" });
  const chrome = h(
    "div",
    { class: "win-chrome" },
    h("span", { class: "win-dots" }, h("i"), h("i"), h("i")),
    h("span", { class: "win-url" }, url),
  );
  const view = h("div", { class: "win-view" }, img);
  const el = h("div", { class: `win${light ? " win-light" : ""}`, style: `width:${width}px` }, chrome, view);
  return { el, img, view, chrome };
}

/** Swap a window's screenshot only when it changes (keeps frames cheap and deterministic). */
export function showSrc(img, src) {
  if (img.getAttribute("src") !== src) img.setAttribute("src", src);
}

/** The pointer. Place with set(cursor, { x, y, s }). */
export function cursor() {
  return h(
    "div",
    { class: "cursor" },
    h(
      "svg",
      { viewBox: "0 0 24 24", width: 34, height: 34 },
      h("path", {
        d: "M4 2.5 20 12l-7.2 1.6L9.6 21z",
        fill: "#fff",
        stroke: "#0B0B0F",
        "stroke-width": 1.4,
        "stroke-linejoin": "round",
      }),
    ),
  );
}

/** Light streams converging on a point (the "noise → clarity" motif from the references). */
export function streams({ count = 28, width, height, cx, cy, seed = 1 }) {
  const svg = h("svg", { class: "streams", width, height, viewBox: `0 0 ${width} ${height}` });
  const paths = [];
  for (let i = 0; i < count; i++) {
    const side = i % 4;
    const u = rand(seed + i * 7.1);
    const sx = side === 0 ? -40 : side === 1 ? width + 40 : u * width;
    const sy = side === 2 ? -40 : side === 3 ? height + 40 : u * height;
    const bend = (rand(seed + i * 3.3) - 0.5) * 260;
    const mx = lerp(sx, cx, 0.5) + bend;
    const my = lerp(sy, cy, 0.5) - bend;
    const p = h("path", {
      d: `M${sx},${sy} Q${mx},${my} ${cx},${cy}`,
      fill: "none",
      stroke: BRAND,
      "stroke-width": 0.6 + rand(seed + i) * 1.4,
      "stroke-linecap": "round",
      pathLength: 1,
      "stroke-dasharray": "0.18 1",
    });
    svg.append(p);
    paths.push({ el: p, phase: rand(seed + i * 11) });
  }
  return {
    el: svg,
    /** flow: 0..1 progress of the light along the paths; o: overall opacity. */
    frame(t, { flow = 1, o = 1 } = {}) {
      for (const { el, phase } of paths) {
        const off = 1.18 - ((t * 0.55 + phase) % 1) * 1.18;
        el.setAttribute("stroke-dashoffset", String(lerp(1.2, off, flow)));
        el.setAttribute("opacity", String(o * (0.25 + 0.6 * phase)));
      }
    },
  };
}

/** The Plainly logo mark as an element. */
let logoIds = 0;
export function logoMark(size = 96) {
  const id = `lg${++logoIds}`;
  const grad = h(
    "linearGradient",
    { id, x1: 0, y1: 0, x2: 1, y2: 1 },
    h("stop", { offset: 0, "stop-color": BRAND_SOFT }),
    h("stop", { offset: 1, "stop-color": "#7B5CFA" }),
  );
  return h(
    "svg",
    { viewBox: "0 0 28 28", width: size, height: size, class: "logo" },
    h("defs", {}, grad),
    h("rect", { x: 1, y: 1, width: 26, height: 26, rx: 8, fill: `url(#${id})` }),
    h("path", {
      d: "M8 9.5h12M8 14h8M8 18.5h5",
      stroke: "#0B0B0F",
      "stroke-width": 2.2,
      "stroke-linecap": "round",
      fill: "none",
    }),
    h("circle", { cx: 19.5, cy: 18.5, r: 2, fill: "#0B0B0F" }),
  );
}
