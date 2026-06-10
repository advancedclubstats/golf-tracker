# Handoff: Dashboard — Direction D ("Calm Brief")

## Overview
This is the redesigned **Dashboard / home screen** for the Advanced Club Stats golf app — the screen a player sees on opening the app. It surfaces, top to bottom: their single biggest "leak" (where they lose the most strokes), their scoring shape vs. a scratch benchmark, a strokes-lost breakdown, a ranked "what to work on" list, then quieter reference stats (snapshot, stat line, recent rounds, course records).

Direction D is the chosen design out of three explored. Its philosophy is **"Calm Brief"**: a flat, editorial, warm-paper layout (no card chrome) where typographic scale and hairline rules carry the hierarchy, with the lime-green brand color reserved for exactly two moments — the hero surface and the primary action.

## About the Design Files
The files in this bundle are **design references created in HTML/React + Babel** — a prototype showing the intended look and behavior. They are **not production code to copy directly**. The component (`Dashboard.jsx`) uses inline `<style>` CSS-in-JS and reads from a static `data.js` purely so the prototype runs standalone in a browser.

Your task is to **recreate this design in the target codebase's existing environment** (its real React/Vue/Swift/etc. stack, component library, and data layer), using its established patterns — not to ship this HTML. Treat `Dashboard.jsx` as a precise spec of structure, hierarchy, and styling, and wire it to the app's real shot data.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, and layout are final and intentional. Recreate the UI pixel-faithfully using the codebase's libraries. Exact token values are in `colors_and_type.css` and itemized under **Design Tokens** below. (In this bundle the component is named `Dashboard`; it was explored under the working name "Direction D".)

## Target sizing
Designed **mobile-first at 390px wide** (iPhone logical width). It is a single vertically-scrolling column. Outer page padding is **24px top, 22px left/right, 30px bottom**.

## Screen: Dashboard

Single scrolling column. Section order, top → bottom:

### 1. Header
- **Layout**: flex row, space-between, `margin-bottom: 24px`.
- **Left**: `Dashboard` — `--font-display` (Bricolage Grotesque) 700, **22px**, letter-spacing −0.02em, color `--ink-900`.
- **Right**: "New Round →" pill button — the **primary action**.
  - Solid `--lime-500` (#CDF23E) background, same-color border, text `--font-ui` 600 **13px** color `--fairway-900` (#0B2E1E).
  - `border-radius: --r-pill` (999px), padding `7px 15px`.

### 2. Hero — "Biggest leak" (the anchor surface)
- **Layout**: full-width block, background `--lime-500`, `border-radius: --r-md` (16px), padding `16px 20px 18px`, `margin-bottom: 36px`. This is the ONE filled surface in the design.
- Text color base `--fairway-900`.
- **Eyebrow**: "Biggest leak" — `--font-mono` (Martian Mono) 600 **12px**, uppercase, letter-spacing 0.08em, word-spacing −0.14em, color = `--fairway-900` at 55% opacity (use `color-mix(in oklab, var(--fairway-900) 55%, transparent)`).
- **Title**: e.g. "Putts 10–20 ft" — `--font-display` 700 **24px**, letter-spacing −0.02em, `margin: 5px 0 2px`, `white-space: nowrap`.
- **Big number**: e.g. "−0.90" — `--font-mono` 700 **38px**, letter-spacing −0.03em, line-height 1, tabular-nums, `margin-top: 7px`. Trailing unit "/ round" is a child `<span>` at **14px**, weight 500, opacity 0.62, `margin-left: 6px`.
- **Subline**: e.g. "6% made vs scratch ≈ 22% · across 48 shots" — `--font-ui` **13.5px**, `margin-top: 10px`, color = `--fairway-900` at 78%.
- This is the single biggest type moment on the screen; nothing below competes with the 38px number.

### 3. Scoring shape
- **Eyebrow header** (shared `.eb-head` style, used by every section below): `--font-mono` 600 12px, uppercase, letter-spacing 0.08em, word-spacing −0.14em, color `--ink-500`, `margin: 0 0 16px`. **No rule/divider line beside headers** — plain label only.
- **Headline row**: net figure "+14%" in `--font-mono` 700 **32px** color `--fairway-600`, followed inline by caption "birdies − doubles per hole" at `--font-ui` 13px `--ink-500`. `margin-bottom: 14px`.
- **Distribution bar**: a single flex row, **height 10px**, `border-radius: --r-pill`, `overflow: hidden`, `margin-bottom: 14px`. Five segments, widths = each band's rate%. Segment colors (the band color map):
  - Eagle+ → `--fairway-600`
  - Birdie → `--fairway-600` at 70% (`color-mix(in oklab, var(--fairway-600) 70%, transparent)`)
  - Par → `--ink-500` at 40%
  - Bogey → `--clay-500` at 75%
  - Double+ → `--negative`
- **Legend**: single full-width column (flex-column). Each row: `padding: 7px 0`, divided by a `1px solid --line` top border between rows (not above the first). Each row is space-between:
  - **Left**: an 8px round color dot (same band color) + label, `--font-ui` 14px `--ink-700`, gap 9px.
  - **Right** (`--font-mono`, tabular-nums, nowrap): the rate `NN%` (inherits 14px ink-900), then a muted target `/ NN%` at **11.5px** color `--ink-300` `margin-left: 8px`, then an optional signed delta at **11.5px** weight 600 `margin-left: 8px`. **Delta color is semantic**: green `--fairway-600` if the delta is good, red `--negative` if bad, `--ink-300` if neutral. (Note "good" is per-band: fewer Bogeys/Doubles than target is good → a negative delta there is green.)

### 4. Where strokes are lost
- Eyebrow header "Where strokes are lost".
- **Big number**: total e.g. "−0.99" — `--font-mono` 700 **40px**, line-height .95, letter-spacing −0.03em, color `--negative`, tabular-nums. Deliberately smaller than the hero's 38px-with-context so it reads as an important *subordinate* number, not a second headline.
- **Caption** under it: "per round vs scratch" — 13px `--ink-500`, `margin: 6px 0 14px`.
- **Category rows**: one per category (Putting, Approach, Short game, Off the tee). Each is space-between, `padding: 10px 0`, top border `1px solid --line`.
  - Label: `--font-ui` 15px `--ink-700`, nowrap.
  - Value: `--font-mono` 600 16px tabular-nums, e.g. "−1.32/rd". Color green `--fairway-600` if positive (gained strokes), red `--negative` if negative (lost).

### 5. What to work on (ranked leaks)
- Eyebrow header "What to work on".
- **Leak rows** (up to 5), each `padding: 12px 0`, separated by `1px solid --line` top border (not the first):
  - **Top line** (space-between): left = rank number `N.` in `--font-mono` 13px `--ink-300` + title in `--font-ui` 600 **15.5px** letter-spacing −0.01em nowrap (gap 10px). Right = strokes-gained value `--font-mono` 700 15.5px color `--negative` tabular-nums, with a trailing "/rd" child at 10.5px weight 500 `--ink-300` (rendered via `<em>` reset to non-italic).
  - **Sub line**: context e.g. "6% made · scratch ≈ 22% · 48 shots" — `--font-ui` 12.5px `--ink-500`, `margin-top: 3px`, `padding-left: 23px` (aligns under the title past the rank).
- **Early reads footnote** (the low-data clubs): below the ranked list, separated by a top hairline + `padding-top: 16px`.
  - Caption "Early reads — not enough data to prescribe yet" — 12.5px `--ink-500`, `margin: 18px 0 10px`.
  - A flex-wrap row of **chips**, gap 8px. Each chip: `--font-mono` 12.5px, background `--paper-sunk`, `border-radius: --r-pill`, padding `5px 11px`, tabular-nums. Content = club label in **bold** (`--ink-900`) + the sg value in `--negative` weight 600 (gap 6px). E.g. `6i −0.20`.

### 6. Snapshot + Stat line (two-up reference)
- Two equal columns, CSS grid `1fr 1fr`, column gap 30px.
- Each column: an eyebrow header ("Snapshot" / "Stat line"), then key/value rows.
- **Row** (`.duo .row`): space-between, `padding: 7.5px 0`, top hairline `1px solid --line` between rows.
  - Label: `--font-ui` **12.5px** color `--ink-500`.
  - Value: `--font-mono` **13px** weight **600** color `--ink-900`, tabular-nums.
- Snapshot data: Rounds Logged 11 · Holes Logged 169 · Total vs Par +15 · Avg vs Par / Round +1.36 · Avg vs Par / Hole +0.09.
- Stat line data: Fairways Hit 38% · Greens in Regulation 69% · Scrambling 37% · Avg Putts / Hole 1.72 · 3-Putt % 4%.

### 7. Recent rounds (table)
- Eyebrow header "Recent rounds".
- A `<table>`, `--font-mono` 13px tabular-nums, columns: Date · Holes · Strokes · vs Par (last column right-aligned).
- Header cells: 10px uppercase letter-spacing 0.05em `--ink-300` weight 600, `padding: 0 8px 8px 0`.
- Body cells: `--ink-700`, `padding: 7px 8px 7px 0`, top border `1px solid --line`.

### 8. Course records
- Eyebrow header "Course records".
- Same `.row` key/value pattern as the strokes-lost section (label `--font-ui` 14.5px `--ink-700` nowrap; value `--font-mono` 500 14.5px tabular-nums), hairline between rows.
- Data: Best Round "16 holes · 61 (-3)" · Worst Round "18 holes · 80 (+9)" · Best Hole "Hole 2 (par 5) · -6 across 10 rounds" · Birdies 29 · Eagles or better 3.

## Interactions & Behavior
The prototype is a static visual. Intended behavior in the real app:
- **New Round** button → starts the shot-entry flow.
- **What-to-work-on rows** are good candidates to be tappable → drill into that leak's detail.
- **Recent rounds** rows → open that round.
- No animations are specified beyond the app's standard navigation transitions. No hover states (mobile/touch).
- Numbers are **derived** from logged shots — none are entered manually (see app PRD). Strokes-gained values, band rates vs. scratch targets, and the ranked leaks all come from the analytics layer.

## State Management
This screen is **read-only / display**. It needs:
- The player's aggregate analytics for the current filter window: biggest leak, strokes-gained by category, scoring bands (rate + scratch target per band), ranked leak list (title, sg, supporting context, shot count), early-read clubs.
- Snapshot + stat-line aggregates, recent rounds list, course records.
- See `data.js` for the exact shape used by the prototype (treat as the view-model contract, not a schema).

## Design Tokens
All values come from `colors_and_type.css` (the project's "Modern Clubhouse" foundation). The ones this screen uses:

**Color**
- `--lime-500: #CDF23E` (hero surface + primary button) · `--lime-600: #B7E000`
- `--fairway-900: #0B2E1E` (on-lime text) · `--fairway-700: #15784A` (primary) · `--fairway-600: #1E8F59` (positive / good deltas) · `--fairway-500: #2BA86C`
- `--clay-500: #E07A3E` (bogey band) · `--clay-700: #B8511F`
- `--negative: #D5443B` (over-par / lost strokes / bad deltas)
- `--ink-900: #14201A` · `--ink-700: #36433C` · `--ink-500: #66726B` · `--ink-300: #9AA39D`
- `--paper: #F6F3EC` (background) · `--paper-sunk: #EFEBE1` (chip wells) · `--card: #FFFFFF`
- `--line: #E4E0D5` (hairlines) · `--line-strong: #D2CDBE`

**Type families**
- Display: `"Bricolage Grotesque"`, 700/800 — titles, the "Dashboard" wordmark, hero title.
- UI / body: `"Hanken Grotesk"`, 400–700 — labels, captions, list titles.
- Mono / data: `"Martian Mono"`, 400–700 — ALL numerals, eyebrows, stat values (always `font-variant-numeric: tabular-nums`).
- All three are on Google Fonts (and self-hosted in the parent project's `fonts/`).

**Radii**: `--r-sm: 10px` · `--r-md: 16px` (hero) · `--r-pill: 999px` (button, chips, bars).

**Spacing**: 8pt base (`--s-1:4` … `--s-8:64`). Section vertical rhythm is a consistent **36px** (`.sec { margin-bottom: 36px }`). Outer padding 24/22/30.

**Shadows**: none used on this screen — the calm/flat treatment is deliberate. (The token set offers `--shadow-sm/md/lg/pop` if the codebase wants subtle elevation, but Direction D intentionally avoids card chrome.)

## Assets
No images or icons in this screen. The only graphic is the CSS-drawn distribution bar (colored flex segments) and round color dots. Fonts load from Google Fonts CDN (see the `<link>` in `preview.html`).

## Files in this bundle
| File | What it is |
|---|---|
| `preview.html` | Runnable standalone — open in a browser to see the design at 390px width. |
| `Dashboard.jsx` | The design component. All structure + CSS-in-JS. **This is the spec.** |
| `data.js` | The static view-model the prototype renders (`window.DASH`). Contract reference. |
| `colors_and_type.css` | The full "Modern Clubhouse" design-token foundation (colors, type scale, radii, spacing, shadows). |

## Note for the developer
This is one screen of a larger app sharing the same design system. If you're implementing the whole app, lift `colors_and_type.css` into your codebase as the single source of design tokens and build all screens against it, rather than hard-coding the hex values per-component.
