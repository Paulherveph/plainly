# Design system

**Feel**: calm, precise, premium. Think "a very good tool", not "a landing page full of tricks".
**One idea**: clarity coming out of noise. The hero shows chaos resolving into order.

## 1. Tokens

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0B0B0F` | Page background (dark first) |
| `--surface` | `#13131A` | Cards |
| `--surface-2` | `#1B1B25` | Raised, hover |
| `--border` | `rgba(255,255,255,0.08)` | Hairlines |
| `--text` | `#F4F4F6` | Primary |
| `--text-muted` | `#9A9AA8` | Secondary |
| `--accent` | `#9478FF` | Single accent, matches your React Bits sample |
| `--ok` / `--caution` / `--critical` | `#3DD68C` / `#F5B83D` / `#FF5C6C` | Severity, always paired with an icon and a label |

Light theme: invert surfaces, keep the same accent, check contrast (AA). Theme toggle in the header.

**Type**: Geist Sans for UI, Geist Mono for quotes and dates. Scale 12, 14, 16, 20, 28, 40, 64. Line height 1.5 body, 1.1 display.
**Space**: 4 px base. Radius 12 for cards, 8 for inputs, full for chips.
**Layout**: max width 1120 px, 12-column grid, generous whitespace.

## 2. Motion rules

- Duration 150–250 ms. Ease-out for entrances. Springs only for layout changes.
- Stagger lists by 40 ms, max 8 items.
- Stream results in section by section. Skeletons match the final layout.
- Everything respects `prefers-reduced-motion`: fall back to opacity only.
- Tokens in `globals.css`: `--dur-1/2/3` (150/200/250 ms), `--ease-out`, `--ease-in`, `--ease-spring`.
- **Pages** enter with a fade and an 8 px rise, and leave faster (`[locale]/template.tsx`, React `<ViewTransition>`).
  The header and footer are named, so they stay still.
- **Skeleton → content**: `RevealSuspense` fades the skeleton out and the content in.
- **Scroll**: `.reveal` is a CSS scroll-driven animation, so it plays scrolling down and back up, with no JS.
  The header gains its hairline once the page scrolls.
- **Lists**: `.stagger` with `--i` on each row, 40 ms apart, max 8.
- **Theme switch**: the new theme grows as a circle from the bordered toggle (View Transitions API).
- **Videos** (`assets/media/videos/`) are content, not effects. They are muted, load lazily, play only in view,
  show the poster only with reduced motion, and have a pause button when longer than 5 s.
- **One** hero effect on the whole site. No parallax stacks, no cursor gimmicks elsewhere.

Every page has a skeleton that matches its layout (`loading.tsx` + module `*-skeleton.tsx`).

## 3. Hero

- Background effect: a React Bits WebGL effect. You liked **Crystallized Ball** (purple `9478FF`, nebula preset).
  - Your sample URL uses 17 000 particles. Use that on desktop only. Use about 4 000 on mobile.
  - Load with `next/dynamic` (`ssr: false`), mount when in view, pause when off-screen.
  - Provide a static image fallback for reduced motion, low power and no WebGL.
- Headline: "Paperwork, in plain language." Sub: one sentence, no jargon.
- Primary CTA: "Try a sample" (zero friction). Secondary: "Upload a document".
- Below the fold: 3-step strip (Upload, Understand, Act), a live analysis preview, privacy statement, FAQ.

## 4. Using the inspiration sources

| Source | What to take | How |
|--------|--------------|-----|
| **React Bits** (reactbits.dev) | Backgrounds and text animations | Copy components with the shadcn CLI or the command on each component page (Installation tab). They land in your repo as source code. Keep 1 background and at most 2 text effects |
| **Prompt Motion** (prompt-motion.com) | Ready prompts for motion videos made with Claude | Pick a **Product UI** or **Kinetic type** prompt, customise it on the site, and generate the 20-second demo for the README and the portfolio |
| **Pinterest hero references** | Layout and hierarchy ideas | Save 3 pins. Ask Claude to describe the structure in words, then build it with your tokens. Do not copy pixel by pixel |

## 5. Components to build first

`Button`, `Input`, `DropZone`, `Card`, `Badge` (severity), `Tabs`, `CitationChip` (page + quote, opens a side sheet), `Skeleton`, `Toast`, `EmptyState`, `DeadlineRow`, `LocaleSwitch`, `ThemeToggle`.

## 6. Analysis screen layout

```
┌───────────────────────────────────────────────┐
│ Title · type · language · [EN FR 中文]         │
├──────────────────────────┬────────────────────┤
│ Summary                  │ Document preview   │
│ Key facts (table)        │ (jumps to the page │
│ Actions & deadlines      │  when a citation   │
│ Watch-outs (severity)    │  is clicked)       │
│ Glossary                 │                    │
├──────────────────────────┴────────────────────┤
│ Ask this document…                      [Send]│
└───────────────────────────────────────────────┘
```

Mobile: single column, preview in a bottom sheet, chat as a sticky input.

## 7. Quality bar

Lighthouse: performance 95+, accessibility 100, best practices 100, SEO 100. Visual check at 375, 768, 1440 with Playwright MCP before every "done".
