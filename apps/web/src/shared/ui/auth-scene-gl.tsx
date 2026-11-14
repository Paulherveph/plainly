"use client";

import { Geometry, Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef } from "react";
import {
  GLOW_LINE,
  type Line,
  LOOP_S,
  phase,
  type Rect,
  type SceneVariant,
  sheetLines,
  sheets,
} from "./auth-scene-timeline";

/**
 * WebGL body of the auth scene (see auth-scene.tsx for loading, tiers and fallbacks).
 * Pass 1, full screen: near-black background and the frosted sheet(s). Pass 2, additive points: thin violet
 * threads made of dense points, and a few paper fragments. Every particle moves between a drifting "cloud"
 * position and a target on a sheet line, driven by `phase()`. All drift is periodic over the loop.
 */

const THREADS = 30;
const MAX_SHEETS = 3;

/** Deterministic, so the poster and the video match the live scene. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Target = { line: Line; index: number };

/** Lines the threads land on: every line of the front sheet, and the heading line of each card behind it. */
function targetsFor(variant: SceneVariant): Target[] {
  const all = sheets(variant);
  const front = all[all.length - 1] as Rect;
  const behind = all.slice(0, -1).flatMap((rect) => sheetLines(rect, 1).map((line) => ({ line, index: -1 })));
  return [...behind, ...sheetLines(front).map((line, index) => ({ line, index }))];
}

function buildParticles(variant: SceneVariant, pointCount: number, fragmentCount: number) {
  const rand = mulberry32(variant === "signin" ? 7 : 11);
  const targets = targetsFor(variant);
  const perThread = Math.max(24, Math.floor(pointCount / THREADS));
  const total = perThread * THREADS + fragmentCount;
  const cloud = new Float32Array(total * 2);
  const target = new Float32Array(total * 2);
  const meta = new Float32Array(total * 4);

  // Threads per line, so each thread covers one segment of its line.
  const byLine = targets.map(() => 0);
  for (let i = 0; i < THREADS; i++) byLine[i % targets.length] = (byLine[i % targets.length] ?? 0) + 1;
  const seen = targets.map(() => 0);

  let p = 0;
  for (let thread = 0; thread < THREADS; thread++) {
    const li = thread % targets.length;
    const { line, index } = targets[li] as Target;
    const slot = seen[li] ?? 0;
    seen[li] = slot + 1;
    const slots = byLine[li] ?? 1;
    const seed = rand();
    // A loose cubic curve across the upper two thirds. x is in units of the canvas half width.
    const pts = Array.from({ length: 4 }, () => [rand() * 2.3 - 1.15, rand() * 1.25 - 0.22] as const);
    for (let k = 0; k < perThread; k++, p++) {
      const s = k / (perThread - 1);
      const u = 1 - s;
      const b = [u * u * u, 3 * u * u * s, 3 * u * s * s, s * s * s] as const;
      cloud[p * 2] = b.reduce((acc, w, j) => acc + w * (pts[j]?.[0] ?? 0), 0);
      cloud[p * 2 + 1] = b.reduce((acc, w, j) => acc + w * (pts[j]?.[1] ?? 0), 0);
      const along = (slot + s) / slots;
      target[p * 2] = line.x0 + (line.x1 - line.x0) * along;
      target[p * 2 + 1] = line.y;
      meta.set([0, seed, s, index === GLOW_LINE ? 1 : line.weight > 1 ? 0.5 : 0], p * 4);
    }
  }

  const front = sheets(variant).at(-1) as Rect;
  for (let f = 0; f < fragmentCount; f++, p++) {
    cloud[p * 2] = rand() * 2.2 - 1.1;
    cloud[p * 2 + 1] = rand() * 1.3 - 0.25;
    target[p * 2] = front.cx + (rand() - 0.5) * front.w * 0.8;
    target[p * 2 + 1] = front.cy + (rand() - 0.5) * front.h * 0.8;
    meta.set([1, rand(), rand(), 0], p * 4);
  }
  return { cloud, target, meta };
}

const POINT_VERTEX = /* glsl */ `
attribute vec2 aCloud;
attribute vec2 aTarget;
attribute vec4 aMeta; // kind (0 thread, 1 fragment), seed, position along the thread, glow role
uniform float uAspect;
uniform float uFit;
uniform float uLoop;
uniform float uGather;
uniform float uNoise;
uniform float uGlow;
uniform float uStagger;
uniform float uDpr;
varying vec4 vColor;
varying float vKind;
varying float vRot;
const float TAU = 6.2831853;

void main() {
  float kind = aMeta.x;
  float seed = aMeta.y;
  float along = aMeta.z;
  float ph = seed * TAU;

  // Periodic drift: integer frequencies over the loop, so the start and end frames match.
  vec2 drift = vec2(sin(TAU * uLoop + ph + along * 3.0), cos(TAU * 2.0 * uLoop + ph * 1.3 + along * 2.2));
  drift *= 0.045 + 0.06 * uNoise;
  vec2 storm = vec2(sin(TAU * 4.0 * uLoop + ph * 7.0 + along * 13.0), cos(TAU * 5.0 * uLoop + ph * 5.0 + along * 11.0));
  drift += storm * 0.05 * uNoise;

  vec2 cloud = vec2(aCloud.x * uAspect / uFit, aCloud.y) + drift;
  // Each thread lays down from one end to the other ("zips" onto its line).
  float delay = seed * uStagger + along * 0.08 * (1.0 - kind);
  float g = smoothstep(delay, delay + 1.0 - uStagger - 0.08, uGather);
  vec2 p = mix(cloud, aTarget, g);
  p.y += sin(3.14159 * g) * 0.04 * (seed - 0.5);

  gl_Position = vec4(p.x * uFit / uAspect, p.y * uFit, 0.0, 1.0);

  vec3 violet = vec3(0.58, 0.47, 1.0);
  if (kind < 0.5) {
    float glowing = step(0.9, aMeta.w) * uGlow;
    float heading = step(0.4, aMeta.w) * step(aMeta.w, 0.6);
    gl_PointSize = (1.6 + heading * 0.6 + glowing * 0.8) * uDpr;
    float a = mix(0.27, 0.45, g) + heading * 0.12 * g + glowing * 0.55;
    vec3 c = mix(violet, vec3(0.92, 0.9, 1.0), glowing * 0.7 + g * 0.15);
    vColor = vec4(c * a, a);
  } else {
    gl_PointSize = (6.0 + seed * 9.0) * uDpr * (1.0 - 0.4 * g);
    float a = 0.16 * (1.0 - smoothstep(0.55, 1.0, g));
    vColor = vec4(vec3(0.86, 0.84, 1.0) * a, a);
  }
  vKind = kind;
  vRot = ph + uLoop * TAU * (seed > 0.5 ? 1.0 : -1.0);
}
`;

const POINT_FRAGMENT = /* glsl */ `
precision mediump float;
varying vec4 vColor;
varying float vKind;
varying float vRot;

void main() {
  vec2 q = gl_PointCoord - 0.5;
  float a;
  if (vKind < 0.5) {
    a = 1.0 - smoothstep(0.15, 0.5, length(q));
  } else {
    // A small sheet of paper, turning slowly.
    float c = cos(vRot), s = sin(vRot);
    q = mat2(c, -s, s, c) * q;
    float box = max(abs(q.x) * 1.0, abs(q.y) * 1.4);
    a = 1.0 - smoothstep(0.3, 0.36, box);
    a *= 0.7 + 0.3 * step(0.31, box);
  }
  gl_FragColor = vColor * a;
}
`;

const SHEET_VERTEX = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const SHEET_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uAspect;
uniform float uFit;
uniform float uGather;
uniform float uGlow;
uniform float uCount;
uniform vec4 uR0;
uniform vec4 uR1;
uniform vec4 uR2;
uniform vec3 uGlowLine;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 card(vec3 col, vec2 s, vec4 r, float alpha, float px) {
  vec2 c = r.xy;
  vec2 hb = r.zw * 0.5;
  float d = sdRoundBox(s - c, hb, 0.045);
  // Soft shadow under the card.
  float shadow = 1.0 - smoothstep(0.0, 0.16, sdRoundBox(s - c + vec2(0.0, 0.03), hb, 0.045));
  col *= 1.0 - 0.55 * alpha * shadow;
  float inside = 1.0 - smoothstep(-px, px, d);
  float top = clamp((s.y - (c.y - hb.y)) / r.w, 0.0, 1.0);
  vec3 frost = vec3(0.07, 0.066, 0.1) + vec3(0.045, 0.04, 0.07) * top + (hash(s * 900.0) - 0.5) * 0.012;
  col = mix(col, frost, alpha * inside * 0.94);
  float edge = 1.0 - smoothstep(0.0, 1.4 * px, abs(d));
  float sheen = 0.1 + 0.16 * smoothstep(0.6, 1.0, top);
  col += vec3(0.78, 0.74, 1.0) * edge * alpha * sheen;
  return col;
}

void main() {
  vec2 s = (vUv * 2.0 - 1.0) * vec2(uAspect, 1.0) / uFit;
  float px = 2.0 / (uRes.y * uFit);
  vec3 violet = vec3(0.58, 0.47, 1.0);

  vec3 col = vec3(0.027, 0.027, 0.04);
  vec2 g = s - vec2(0.0, 0.42);
  col += violet * 0.085 * exp(-dot(g, g) * 1.1);
  col *= mix(0.7, 1.0, smoothstep(-1.0, 0.0, s.y));

  float base = smoothstep(0.5, 1.0, uGather);
  if (uCount > 2.5) {
    col = card(col, s, uR0, smoothstep(0.62, 1.0, uGather), px);
    col = card(col, s, uR1, smoothstep(0.56, 1.0, uGather), px);
    col = card(col, s, uR2, base, px);
  } else {
    col = card(col, s, uR0, base, px);
  }

  float dx = max(max(uGlowLine.x - s.x, s.x - uGlowLine.y), 0.0);
  float dy = s.y - uGlowLine.z;
  float dd = dx * dx * 4.0 + dy * dy;
  col += violet * uGlow * 0.3 * exp(-dd / 0.0016);

  // Dither by about one 8-bit step, so the dark gradients do not band.
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export type AuthSceneGLProps = {
  variant: SceneVariant;
  /** Thread points; fragments are derived from it. */
  count: number;
  /** Seconds. Draws one still frame at that time (poster capture). */
  freezeAt?: number;
  onReady?: () => void;
};

export default function AuthSceneGL({ variant, count, freezeAt, onReady }: AuthSceneGLProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const renderer = new Renderer({ alpha: false, antialias: false, depth: false });
    const gl = renderer.gl;
    gl.clearColor(0.027, 0.027, 0.04, 1);
    const canvas = gl.canvas;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);

    const rects = sheets(variant);
    const glowLine = sheetLines(rects.at(-1) as Rect)[GLOW_LINE] as Line;
    const vec4Of = (r: Rect | undefined) => (r ? [r.cx, r.cy, r.w, r.h] : [0, 0, 0, 0]);
    const shared = {
      uAspect: { value: 1 },
      uFit: { value: 1 },
      uGather: { value: 0 },
      uGlow: { value: 0 },
    };
    const sheetProgram = new Program(gl, {
      vertex: SHEET_VERTEX,
      fragment: SHEET_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        ...shared,
        uRes: { value: [1, 1] },
        uCount: { value: Math.min(rects.length, MAX_SHEETS) },
        uR0: { value: vec4Of(rects[0]) },
        uR1: { value: vec4Of(rects[1]) },
        uR2: { value: vec4Of(rects[2]) },
        uGlowLine: { value: [glowLine.x0, glowLine.x1, glowLine.y] },
      },
    });
    const sheetMesh = new Mesh(gl, { geometry: new Triangle(gl), program: sheetProgram });

    const fragments = Math.max(16, Math.round(count / 130));
    const { cloud, target, meta } = buildParticles(variant, count, fragments);
    const pointProgram = new Program(gl, {
      vertex: POINT_VERTEX,
      fragment: POINT_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        ...shared,
        uLoop: { value: 0 },
        uNoise: { value: 0 },
        uStagger: { value: variant === "signin" ? 0.32 : 0.12 },
        uDpr: { value: 1 },
      },
    });
    pointProgram.setBlendFunc(gl.ONE, gl.ONE);
    const points = new Mesh(gl, {
      mode: gl.POINTS,
      geometry: new Geometry(gl, {
        aCloud: { size: 2, data: cloud },
        aTarget: { size: 2, data: target },
        aMeta: { size: 4, data: meta },
      }),
      program: pointProgram,
    });

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      renderer.setSize(width, height);
      const aspect = width / height;
      shared.uAspect.value = aspect;
      // Shrinks on very narrow cards, grows a little on wide ones; the lower third stays clear either way.
      shared.uFit.value = Math.min(1.12, aspect / 0.62);
      sheetProgram.uniforms.uRes.value = [gl.canvas.width, gl.canvas.height];
      pointProgram.uniforms.uDpr.value = renderer.dpr;
    };

    const draw = (seconds: number) => {
      const ph = phase(seconds, variant);
      shared.uGather.value = ph.gather;
      shared.uGlow.value = ph.glow;
      pointProgram.uniforms.uNoise.value = ph.noise;
      pointProgram.uniforms.uLoop.value = (seconds % LOOP_S) / LOOP_S;
      renderer.render({ scene: sheetMesh });
      renderer.render({ scene: points, clear: false });
    };

    // Time only advances while the scene is visible, so a pause never causes a jump.
    let raf = 0;
    let elapsed = 0;
    let last = 0;
    let inView = true;
    let first = true;
    const tick = (now: number) => {
      elapsed += last ? Math.min(now - last, 100) / 1000 : 0;
      last = now;
      draw(elapsed);
      if (first) {
        first = false;
        ready.current?.();
      }
      raf = requestAnimationFrame(tick);
    };
    const play = () => {
      if (raf || freezeAt !== undefined || !inView || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    const pause = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? pause() : play());

    const ro = new ResizeObserver(() => {
      resize();
      if (freezeAt !== undefined || !raf) draw(freezeAt ?? elapsed);
    });
    ro.observe(container);
    const io = new IntersectionObserver(([entry]) => {
      inView = Boolean(entry?.isIntersecting);
      if (inView) play();
      else pause();
    });
    io.observe(container);
    document.addEventListener("visibilitychange", onVisibility);

    resize();
    if (freezeAt !== undefined) {
      draw(freezeAt);
      ready.current?.();
    } else play();

    return () => {
      pause();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      points.geometry.remove();
      sheetMesh.geometry.remove();
      pointProgram.remove();
      sheetProgram.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, [variant, count, freezeAt]);

  return <div ref={ref} data-testid="auth-scene-canvas" className="absolute inset-0" />;
}
