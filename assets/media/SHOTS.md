# Screenshots

Real captures of the app (fake AI, the built-in lease sample). Regenerate with:

```bash
pnpm dev --port 3200          # USE_FAKE_AI=true in .env.local
BASE=http://localhost:3200 node media/capture.ts            # all four sets
BASE=http://localhost:3200 ONLY=mobile-light node media/capture.ts
```

Sets: `desktop/` 1440×900 @2x and `mobile/` 390×844 @3x, each in `dark/` and `light/`.
WebP copies are committed; PNG masters go to `raw/` (gitignored) and feed the video renders.

| # | Shot | What it shows | Used in |
|---|---|---|---|
| 01 | landing-hero | Headline, CTAs, Crystalized Ball | V1 open, V6 hook, README |
| 02 | landing-how | Three steps | V3 scene 3 |
| 03 | landing-features | Quote, deadlines, watch-outs, chat tiles | V6 cuts |
| 04 | landing-install | Desktop + mobile install section | Social, README |
| 05 | landing-full | Whole landing page (scroll scenes) | V1/V6 scroll pass |
| 06 | documents-empty | Upload card + samples | V1 scene 1, V2 chapter 1 |
| 07 | analysis-streaming | Sections arriving | V1 scene 2, V2 chapter 2 |
| 08 | analysis-ready | Summary + key facts + original | V1 scene 2, V3 scene 2, install device frame (`public/images/app-desktop.webp`) |
| 09 | analysis-full | Every section, full height | V1 scroll, V2 chapter 2 |
| 10 | citation-sheet | Quote found, "Show on page" | V1 scene 3, V3 proof scene |
| 11 | chat | Grounded answer with a quote, then a refusal | V1 scene 5, V6 |
| 12 | deadlines | Overdue + upcoming, .ics export | V1 scene 4, V2 chapter 3, install phone (`public/images/app-mobile.webp`) |
| 13 | documents-library | Library with the analysed lease | V6 |
| 14 | privacy | Privacy page | V5 privacy loop poster |
| 15 | sign-in / menu | Save-your-work dialog (desktop), menu (mobile) | README |
| 16 | not-found | 404 | Docs only |

Rules for using them: never crop out the "not legal advice" line on analysis shots, and keep the
sample data (Amina Diallo, 14 Rue des Lilas): it is fictional and safe to publish.
