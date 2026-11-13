# Blockers

## S1 / HERO.md landing fix 2: "See it work" clips are still small

- **Item.** "The text inside the frames is unreadable at this size. Crop each clip to one region and scale it up, or use annotated static screenshots with a single zoomed callout."
- **Evidence.** `docs/gate-reports/S1` (1440 fold and the how-it-works viewport). The kept clip (`steps`, 1600×1000) shows a whole 1440 px app window, so its body text renders at about 6 px on a 1440 px page.
- **What was done.** The full-frame `showreel` section and its strings were removed; the page keeps one clip (steps), with chapter chips that stay readable. Cycles used: 0 of 3 for the crop itself.
- **Why no crop yet.** `assets/media/videos/steps.html` choreographs three chapters (upload, understand, act) across the whole window, with scrolling and a cursor. A static CSS crop would cut the action in at least two chapters. A real fix means re-choreographing the clip with a zoom per chapter, or replacing it with three annotated screenshots. That is a design choice.
- **Hypothesis.** Three still screenshots with one zoomed callout each (the summary, the quote at its source, the deadline), tied to the existing step cards, read better than a video at this size and cost less to load.
- **Needs from the owner.** Pick: (a) re-choreograph `steps.html` with zoom, (b) three annotated screenshots instead of the clip, (c) accept the clip as it is.
