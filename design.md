# design.md — UAP Archive (Lumen-derived DNA)

> Locked design system for this project. Every page and component defers to this file.
> DNA extracted (Hallmark `study`) from the Lumen-01 reference (usehallmark.com/examples/lumen-01),
> rendered live and analyzed. This is DNA, not a pixel copy: warm-dark editorial-technical mood,
> three-typeface system, single amber accent, annotated-diagram treatments.

## Mood / Genre

Warm-dark **editorial-technical**. Confident, minimal, archival. The subject is declassified
government UFO files — the design should feel like a well-made research instrument, not a
sci-fi fan site. "Furnace/ember against near-black" translates here to "a redacted file lit by
a single desk lamp." Intriguing but factual.

## Mode & Surface

- **Dark mode.** Warm near-black base, faint blueprint grid overlay.
- Never pure `#000` / `#fff` — everything tinted warm (anchor hue ~60–70).

## Tokens (locked — reference by name only, never inline)

```css
:root {
  /* Paper / surfaces (warm near-black) */
  --color-paper:     oklch(14%  0.008 65);   /* base bg  ~#0C0B0A */
  --color-paper-2:   oklch(17%  0.010 65);   /* raised surfaces */
  --color-paper-3:   oklch(21%  0.010 65);   /* hover / elevation */
  --color-rule:      oklch(30%  0.008 65);   /* hairline dividers ~#2A2724 */

  /* Ink / text (warm off-white → dim) */
  --color-ink:       oklch(94%  0.006 80);   /* headings/primary ~#F2EFEA */
  --color-body:      oklch(74%  0.006 70);   /* body copy ~#A8A29A */
  --color-muted:     oklch(56%  0.006 65);   /* meta/labels ~#6B6660 */

  /* Accent — amber (the single functional accent, <=3% of viewport) */
  --color-accent:    oklch(75%  0.13  60);   /* amber ~#E9975E */
  --color-accent-2:  oklch(66%  0.11  35);   /* coral highlight ~#CE6E5C (emphasis word) */
  --color-focus:     oklch(78%  0.15  60);

  /* Type */
  --font-display: "Fraunces", "Canela", Georgia, serif;   /* high-contrast serif, lowercase */
  --font-body:    "Inter", "Neue Haas", system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace;

  /* Space (8-pt scale) */
  --space-xs: 0.5rem; --space-sm: 0.75rem; --space-md: 1rem;
  --space-lg: 1.5rem; --space-xl: 2.5rem; --space-2xl: 4rem; --space-3xl: 6rem;

  --radius:   14px;      /* pill/card radius */
  --radius-pill: 999px;
}
```

## Typography discipline

Three-typeface system — the core of the DNA:
- **Display serif** (`--font-display`): headings, case titles. **Lowercase, roman (never italic).**
  High contrast, large scale. Emphasis via `--color-accent-2` + a thin drawn underline, not italics.
- **Body sans** (`--font-body`): running copy, summaries, UI. Regular weight, muted color.
- **Mono** (`--font-mono`): ALL technical/meta labels — dates, case IDs, coordinates, section
  numbers, stat values. UPPERCASE, letter-spaced, `·` dot separators
  (e.g. `CASE · 7272799`, `1948 · KANSAS`, `CONF · 84.8%`).

## Signature treatments (carry these across pages)

1. **Faint blueprint grid** overlay on the base surface.
2. **Floating pill nav** — rounded-full dark capsule, 1px `--color-rule` border, centered.
3. **Pill buttons** — filled amber (dark ink text) primary; ghost 1px-border secondary with `→`.
4. **Annotated-diagram callouts** — small dark rounded badges (`--color-paper-2`, faint border)
   with mono uppercase text, tethered by 1px amber leader lines. Use for the map markers and
   case-card metadata (shape/date/location badges).
5. **Hairline rules** (`--color-rule`) between sections; generous `--space-3xl` between majors.
6. **Single amber glow** as the only strong light source — used sparingly (active map marker,
   Case-of-the-Day highlight).

## Macrostructure

**19 · Map / Diagram** (a spatial map organizes the page) blended with **20 · Ecosystem Index**
(multiple browse surfaces: search / Case of the Day / suggested chips / map). This is the page
shape — NOT hero→3-features→CTA. Two Hallmark outputs must not share a macrostructure; this one
is stamped in the global CSS.

## Tone / copy rules (subject-matter critical)

- Intriguing but **factual**. Present what documents say; never assert extraordinary claims.
- Every AI summary ends with its source citation (case ID + archive link).
- No fabricated content. Poor OCR → "Original document available — text extraction incomplete."
- Mono labels are terse and archival; serif headings are evocative but grounded in the record.

## Mobile (hard floor)

Verified at 320 / 375 / 414 / 768px. No horizontal scroll (`overflow-x: clip` on html+body).
No two-line clickable text. Image grid tracks use `minmax(0,1fr)`. Map collapses to a
tap-to-expand panel under 768px; search stays front-and-center.
