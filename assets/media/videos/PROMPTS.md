# Video prompts, adapted to Plainly

The prompts collected in `z.md` were written for other products (Distilbook, Supademo, a motion
designer's showreel). Each one is rewritten here for Plainly, then built as one HTML file in this
folder and rendered with `node media/render.mjs <name>`.

Shared rules for all of them:

- **Look.** Dark canvas `#0B0B0F`, one accent `#9478FF`, Geist and Geist Mono, glass panels and
  light lines that converge (from `images-mockup/`). There are no stock footage, particle bursts or
  random transitions.
- **The dot.** A purple dot ties every scene together. It is the toggle knob, the dot over the i in
  "Plainly", the point that traces the spring graph, and the dot in the logo mark.
- **Real UI only.** Every product shot is a real screenshot from `media/capture.ts` (see `../SHOTS.md`).
- **Deterministic.** Each visual is a pure function of time inside `seek(t)` (`lib/engine.js`).
  Springs are closed form, and the graph is drawn from the same spring that moves the dot.
- **Check before the full render.** `--stills` renders one frame per beat, and `media/sheet.sh`
  tiles them into one contact sheet.

| File | From (z.md) | Length | Used on |
|---|---|---|---|
| `showreel.html` | Prompt Motion "Plainly showreel" + Distilbook showreel | 20 s, 16:9 | Landing, "See it work" |
| `steps.html` | MengTo html-demo (app window, step by step) | 12 s, 3 chapters | Landing, "How it works" (cards jump to a chapter) |
| `explainer.html` | 30-second animated explainer, 5 scenes | 30 s, 16:9 | Hero, "Watch the 30-second explainer" dialog |
| `brand-loop.html` | Orange-dot motion film | 15 s seamless loop | Landing, final CTA |
| `loops.html?scene=…` | Same dot language, micro loops | 5 s each, dark + light | Empty states: documents, deadlines, privacy |
| `launch.html` (`?vertical`) | Supademo launch video | 25 s, 16:9 + 9:16 | Social only (`media/out/`) |

Skipped: the recursion video in `z.md`. It has nothing to do with Plainly.

---

## V1 · Showreel (`showreel.html`)

> Make a dynamic 20-second product showreel for Plainly, "Paperwork, in plain language." Dark premium
> UI, accent #9478FF, soft depth. Hook in the first second, then show these moments in order: drop a
> lease into the upload zone; the analysis streams in section by section (summary, key facts,
> actions with deadlines, watch-outs); a citation chip is clicked and the source quote appears; the
> deadlines list with an overdue item and a calendar export; a chat answer quoted from the document,
> then a refusal for something the lease doesn't say. End on the logo, the tagline and
> "Try a sample · no sign-up". Every move is driven by the cursor or by the dot.

Beat map (seconds): `0.0` lease fragments drift in · `1.0` "Paperwork," letters spring in ·
`1.45` the dot lands · `2.45` the window rises · `3.0–4.15` the cursor carries lease.pdf · `4.2` drop ·
`4.75–7.4` five section reveals · `6.9–8.8` the page scrolls to the watch-outs · `9.05` zoom on the
citation chip · `10.25` click · `10.45` source sheet · `12.75` the date flies to the calendar · `13.2` .ics ·
`14.55–16.1` chat messages, one by one · `17.35` logo · `18.15` CTA.

## V2 · How it works (`steps.html`)

> Build a live HTML product demo: a Mac-style window that plays Plainly step by step, with every frame
> drawn from one clock so it can loop, scrub, jump to a step and freeze. Three chapters of 4 seconds:
> 01 Upload (a file is dragged into the drop zone), 02 Understand (sections stream in, the page
> scrolls), 03 Act (the cursor ticks a deadline). A chapter badge swaps with separate out and in
> timing. The last frame matches the first.

Chapters start at `0`, `4` and `8` s. On the site, the three step cards follow `currentTime` and
clicking a card seeks to `index × 4`.

## V3 · 30-second explainer (`explainer.html`)

> Adopt the role of an expert motion designer. Build a 30-second animated explainer for Plainly as a
> single HTML page, in 5 scenes of 6 seconds: (1) the problem, a wall of real lease text with the
> jargon in red, then "Leases. Visa letters. Job offers." and "Dense legal text. Easy to misread.";
> (2) what Plainly does, the wall folds into one summary card that types itself; (3) how it works
> in three steps, Upload, Understand, Act, each with a real screenshot; (4) one proof point:
> 98% of quotes found word for word in the document, and a claim with no quote is struck out and
> removed; (5) the name: logo, "Plainly", tagline and CTA. Bold type, smooth transitions, #9478FF.

Beat map: `0.35 / 0.9 / 1.45` the three document types · `2.95` "Dense legal text." · `6.2` summary card ·
`7.0–10.4` typing · `12.5 / 13.1 / 13.7` step cards · `16.2–17.4` the dot visits each step · `18.3` counter to 98% ·
`21.3` claim card · `22.1` strike · `23.0` removed · `24.2` logo.

## V4 · Brand loop (`brand-loop.html`)

Adapted from the orange-dot film. The orange becomes Plainly purple, and the inputs are filled from
the product: toggle label "Plain language", hero word "Plainly", graph value 98% (quotes verified),
final card "Plainly / Paperwork, in plain language. / Every claim, quoted."

> A 2D motion film in 16:9 on near-black, bold Geist type and one purple accent. The dot connects every
> scene. Open: a cursor clicks the toggle beside "Plain language"; the knob becomes the dot, the letters
> of "language" bend and fall, "ly" springs in, and the dot settles over the i of "Plainly". Spring: the
> dot jumps onto a graph and draws a spring response that overshoots and settles beside "98%". Shape:
> the dot shoots along a line, grows into a circle that fills the frame; a dark rounded page rotates in
> it, then stretches into a citation pill "p.1 · §4"; everything contracts back to one dot. Type:
> SUMMARY, DEADLINES, QUOTES, CHAT, FRANÇAIS, 中文 orbit the dot, then their letters fly outward into a
> halftone field that grows past the edges and flips to black for the end card. Return: the dot
> travels back through the halftone and the graph to the toggle. The last frame equals the first.

Beat map: `0.9` click · `1.25` letters move · `1.95` "ly" · `2.3` dot on the i · `2.6` jump · `3.1–4.7` graph ·
`4.35` 98% · `5.0` shoot · `5.4` circle fills · `6.0` page rotates · `6.8` pill · `7.4` contract · `8.1` orbit ·
`10.1` letters fly out · `10.5–12.0` halftone · `12.25` end card · `13.75–14.95` return.

## V5 · Empty-state loops (`loops.html`)

> Three 5-second loops in the same dot language, rendered on the card colour in both themes, for the
> empty states. `summary`: a dense page folds into three lines and a dot, which is the Plainly mark.
> `deadline`: a calendar flips to 20 November, the dot lands and a tick confirms. `expiry`: a 30-day
> ring runs down and the file dissolves into dots, then comes back.

They play twice, then rest on the last frame. With reduced motion only the poster shows.

## V6 · Launch cut (`launch.html`)

> You're a world-class motion designer building Plainly's launch video. The core value: understand any
> document in plain language, with every claim quoted. Hook in the first second ("Your lease: 3 pages
> of legal text." / "Somewhere in it are 3 deadlines." / "Do you know them?"), then quick cuts of the
> real UI with one caption each, a distinct beat for the AI ("Every claim quotes the document." /
> "If it isn't there, it says so."), languages, trust (deleted after 30 days, not legal advice), and the
> end card. Score every cut to a beat at 120 BPM.

Cuts land every 0.5 s beat (1, 1.5 or 2 beats each). Each cut has a two-frame accent flash and a
spring punch. The end card hits the downbeat at `18.5` s.
**Music.** None is bundled. Pick a 120 BPM track with a drop at 18.5 s, then
`node media/render.mjs launch --social --audio track.mp3` (and again with `--vertical`).

---

## Rendering

```bash
media/render-all.sh                                   # every site video + social masters
node media/render.mjs showreel --stills               # beat stills → media/out/stills/showreel/
media/sheet.sh media/out/stills/showreel sheet.png    # one contact sheet
node media/render.mjs --serve                         # live preview at http://localhost:4600/videos/
```

Site renders go to `public/videos/` as 1280 px MP4 (H.264) and WebM (VP9), with a WebP poster, about
1.3 MB or less each. Social masters go to `media/out/` at full 1080p (gitignored).
