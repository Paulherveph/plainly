# Third-party notices

Plainly's own code is under the [MIT license](LICENSE). The parts below come from other authors and keep their own licenses. npm dependencies are not copied into this repository; each keeps its license in `node_modules` (list them with `pnpm licenses list --prod`).

## Code copied into the repository

| Component | Source | License | Where |
|---|---|---|---|
| Crystalized Ball (WebGL orb) | [React Bits](https://reactbits.dev) by David Haz, installed with the shadcn CLI | **MIT + Commons Clause v1.0** ([license](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md)) | `apps/web/src/shared/ui/crystalized-ball.tsx` (one local patch: pixel ratio capped at 1.5) |
| UI primitives (button, dialog, sheet, tabs…) | [shadcn/ui](https://ui.shadcn.com), generated into the project | MIT | `apps/web/src/shared/ui/` |

> **The React Bits component is not covered by Plainly's MIT license.** Its Commons Clause lets you use it inside an application, including a commercial one, but not sell, sublicense or redistribute the component itself. If you fork Plainly to redistribute or sell code, remove or replace `crystalized-ball.tsx`: the hero then shows its static fallback (`StaticOrb` in `hero-orb.tsx`).

## Fonts, icons and libraries used at runtime

| What | Source | License |
|---|---|---|
| Geist and Geist Mono fonts | Vercel, loaded with `next/font/google` (not committed) | SIL Open Font License 1.1 |
| Icons | [Lucide](https://lucide.dev) (`lucide-react`) | ISC |
| WebGL helper | [OGL](https://github.com/oframe/ogl) | Unlicense |
| PDF text extraction | [unpdf](https://github.com/unjs/unpdf) / pdf.js | MIT / Apache-2.0 |
| Word preview | [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) | Apache-2.0 |

Notable licenses among installed dependencies: `@img/sharp-libvips-*` (LGPL-3.0-or-later, a prebuilt native library installed by `sharp`, not modified or bundled here), `jszip` (dual MIT or GPL-3.0, used under MIT), the `sentry` package (FSL-1.1-Apache-2.0), `caniuse-lite` data (CC-BY-4.0).

## Media

Screenshots, videos and the walkthrough in `assets/media/` and `apps/web/public/` are captured from Plainly itself. The documents in `test-documents/`, `apps/web/samples/` and `apps/web/evals/` are fictional and written for this project.
