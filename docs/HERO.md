# Hero and landing upgrade (Stage S1)

## Assessment
The frontend developer is right. On a 1865 px wide screen the orb measures about 160 px, under 10% of the width, and the product mockup overlaps its lower half. It reads as a decoration, not as the signature of the brand. The orb already has the right idea (noise becoming order), so make it the stage, not a badge.

Two other things hold the page back on large screens: the content container is about 1120 px, and the headline is about 40 px. Both look timid on 1920 to 4K monitors.

## Direction: "the orb is the stage"
- **Size.** Orb diameter `clamp(280px, 38vw, 680px)`. It is at least 30% of the viewport width from 1280 px up. On mobile it is 280 to 320 px.
- **Composition.** Headline and CTAs on top, orb centered below them, the product mockup rises out of the lower third of the orb and overlaps it. A soft radial glow in `--accent` sits behind. Edges of the canvas are masked with a radial gradient so there is no visible rectangle.
- **Story tied to scroll.** One effect, one idea. Scroll progress drives the orb from chaotic to calm: `crackle`, `sway` and `twinkle` go down, particles tighten, and the document sheet in the mockup comes into focus. It must not scroll-jack. Scroll only changes parameters.
- **Pointer.** Slight tilt toward the cursor (max 6°), disabled on touch and for reduced motion.
- **Type.** Headline `clamp(2.75rem, 1.4rem + 4.6vw, 5.5rem)`, line height 1.05, balanced wrapping (`text-wrap: balance`). Sub copy `clamp(1rem, 0.9rem + 0.4vw, 1.25rem)`.
- **Container.** Marketing pages use a fluid container: `max-width: clamp(1120px, 80vw, 1440px)`. App pages (documents, deadlines) keep a 1120 px reading width.

## Performance and fallbacks (non-negotiable)
- Canvas loads after first paint (`next/dynamic`, `ssr: false`, mount on idle and when in view). The LCP element is the headline, never the canvas.
- Device pixel ratio capped at 1.5. Particle count by tier: desktop 17 000, laptop with integrated GPU 8 000, mobile 4 000. Pick by viewport width and `navigator.hardwareConcurrency`, then lower automatically if the frame time stays above 20 ms for 2 seconds.
- Pause when off-screen or the tab is hidden. Dispose the WebGL context on unmount.
- Static fallback image (webp, under 60 KB, rendered from the real orb) for: reduced motion, no WebGL, save-data, battery saver, very slow frames.
- Text on top of the orb keeps contrast 4.5:1 or better, measured at the worst frame.

## Other landing fixes found in the screenshots
1. **Final CTA card.** The media block shows a flat purple rectangle with a black square or a "p.1 · §4" chip. It looks broken. Inspect the component. Replace it with the actual product mockup, or remove the media and keep the text and buttons.
2. **"See it work" clips.** The text inside the frames is unreadable at this size. Crop each clip to one region (the summary, the citation opening, the deadline) and scale it up, or use annotated static screenshots with a single zoomed callout.
3. **Section rhythm.** The page is long and uniform. Merge "How it works" and "What you get" into one section, keep one clip, keep the FAQ.
4. **Add a "Pricing" link** to the header after Stage S4, and a compact pricing teaser above the FAQ.
5. **Social proof slot.** Reserve a row for a short real quote or a counter ("documents explained"), shown only when real numbers exist. Do not invent testimonials.

## Acceptance criteria (measured with Playwright)
- Screenshots at 390, 768, 1280, 1440, 1920, 2560 px stored in `docs/gate-reports/S1/`.
- At 1440 px and above, the orb width is at least 30% of the viewport and the headline is never covered.
- Lighthouse mobile: performance 90 or better with the orb enabled, accessibility 100.
- CPU throttled 4x in Playwright: median frame time under 22 ms after the automatic quality step-down.
- With `prefers-reduced-motion`, no animation runs and the static fallback shows.
- No console errors. No layout shift above 0.05.

## Prompt for Claude Code
```
Read docs/HERO.md. Implement the hero upgrade and the landing fixes in apps/web.
Use Context7 for the current React Bits install steps and Motion API. Keep the existing orb component and
parameters (color 9478FF, nebula preset) and make it responsive as specified.
Take Playwright screenshots at the six widths, compare them with the acceptance criteria, fix, and repeat (max 3 cycles).
Report with the standard format from INSTRUCTIONS.md section 5.
```
