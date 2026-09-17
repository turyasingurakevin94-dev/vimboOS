# Omni-Ware admin — design system handoff

A single reference for implementing any Omni-Ware admin screen so it looks like the rest.
Written to be handed to an implementer (including Claude Code) together with the reference
design files in this folder.

**How to use it.** Read §1–§4 before writing any markup. When you need a component, copy its
recipe from §5 rather than inventing one. When a value is not in here, take it from the nearest
reference file in this folder — do not invent a new colour, radius, font size or spacing step.
If a screen seems to need something the system has no part for, say so and propose the part;
a one-off is a defect, not a solution.

Reference files (real markup, open them in a browser):

| File | What it shows |
| --- | --- |
| `Dashboard.dc.html` | Today — desktop `#2a`, phone `#2b`. The metric strip, the queue cards, the insight rail. |
| `Order tracking.dc.html` | The lane board, the four-tile strip, the needs-you queue, the canonical navy top bar and rail. |
| `Invoices v2.dc.html` | The register pattern: lenses, control line, bulk bar, table rows with one labelled action. |
| `Rail.dc.html` | **The authority on navigation.** If a screen's rail disagrees with this file, this file is right. |
| `support.js` | Runtime the `.dc.html` files need in order to render. Not part of the implementation. |

---

## 1. What the system is for

Omni-Ware is an admin app for a Ugandan wholesale hardware shop. The person using it is the
owner or a counter clerk, on a desktop in the shop and a phone on the road, often on a slow
link. Every screen answers one question about money or stock and then offers the one action that
follows from the answer.

Three rules sit above all the styling:

1. **A figure is never decorated and never rounded.** Money is written in full, in the figure
   face, right-aligned in tables. `5,324,000` — not `5.3M`, not a progress bar instead of the
   number. The one exception is the phone header strip, where the full figure is one tap away.
2. **Every figure carries its basis.** A number on its own is not readable. `81,724,995` gets
   `94% of 86,998,995 raised on 155 invoices` under it. If a derivation failed, say what failed —
   never render zero.
3. **One accent, one next action.** The coral fill appears once per screen, on the single thing
   the owner should do next. Everything else is ink, rules and tints.

---

## 2. Tokens

Use these values literally. They are the whole palette; there is no step between them.

### Ground and ink

```
--bg            #f2efe9   app ground behind cards (older files: #f6f5f2 — either is fine, pick one per app)
--canvas-edge   #DCE0E4   the ground the design frames sit on (presentation only)
--surface       #ffffff   cards, rows, fields
--surface-2     #f7f6f3   inner tiles, group headers inside a card
--row-hover     #faf9f6
--hairline      #ecebe6   card borders
--rule          #f0eeea   rules between rows inside a card
--control-edge  #cdc9c0   borders of buttons, selects and search fields on the ground
--divider       #dcdad4   the one strong rule under a page header

--ink           #1b2233   body and figures
--ink-2         #535d70   secondary prose (4.5:1+ on white and on every tint)
--ink-3         #5f6a7d   labels, meta, basis lines
--ink-4         #8a939c   icon-only chrome and disabled figures — never body text
```

### Chrome (rail, top bar, phone header)

```
--navy          #17223c   rail, top bar, phone header, dark buttons, picked-row bar
--navy-hover    #243354
--rail-ink      #c7cfd8   rail row label at rest
--rail-ink-2    #b9c2d6   chip text on navy
--rail-head     #a8b2c7   section captions, muted figures on navy
--rail-meta     #8b96ad   breadcrumb parent, chevrons on navy
--rail-hover    rgba(255,255,255,.07)
--rail-active   #ffffff   the row you are on is a WHITE pill with #17223c ink
--on-navy-chip  rgba(255,255,255,.14)
--on-navy-rule  rgba(255,255,255,.09)
```

### Accent — the one next action

```
--accent        #ef4b39   fill and icon only, and the 3px left border of the row that needs you
--accent-btn    #c2311f   the filled button colour (white text on it clears 4.5:1)
--accent-btn-hv #a5291a
--accent-ink    #b2301f   accent-coloured TEXT (doc numbers that are open, overdue figures)
```

`#ef4b39` is **never text**. If you need coral type, use `--accent-ink`.

### Meaning — bad / caution / good / studied

```
bad      fill #fff1ec   chip #ffe1dc   ink #b2301f
caution  fill #fff3d9   chip #ffeccd   ink #96600f
good     fill #ecf8f2   chip #e2f5ec   ink #0f7a56   strong #0b5e42
info     fill #eef4ff   chip #eaf1ff   ink #1d5bb8
studied  fill #f4f1ff   chip #e5dffd   ink #5b46d6    (the Manager's mark, value bars, design notes)
neutral  chip #f2f0ec   ink #5f6a7d
```

A tint means something. Green is money collected or a stage cleared, amber is part-done or
waiting, coral-red is late or wrong, violet is "the app worked this out", grey is inert. Never
tint for variety.

### Section chips (rail group marks)

```
Sell      #ffe3d6 / #8f3009      Buy     #e6e3ff / #4230a8
Catalogue #d9f2e6 / #0b5e42      Money   #d7e8ff / #164a96
Insight   #ffdfe9 / #8a2450      Setup   #f0eeea / #5f6a7d
```

### Chart and bar ramps

```
green   #c3e2d3 #a9d7c2 #71bfa0 #3f9f7c #1a8f66 #0f7a56
violet  #5b46d6 #7a68e0 #9a8ceb #bcb2f2
aging   #c7d3e8 (0–14 days) · #f0a98f (15–30) · #ef4b39 (30+)
stage   taken #7f8aa3 · buying #8f7fd6 · preparing #e0a33a · out #5b8ad6 · delivered #4d9c76
```

### Type

Two faces only. IBM Plex Sans for everything, IBM Plex Mono for every figure. `Archivo Black`
is used for one string in the whole app: the `OMNI-WARE` wordmark in the top bar.

```html
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

Self-host these in production — the shop is on a slow link.

```
sizes (px, no steps between): 9.5 10 10.5 11 11.5 12 12.5 13 13.5 14 14.5 15 16 19 26 28
weights: 400 body · 500 rail rows and large figures · 600 labels, buttons, names · 700 headings
line-height: 1.1 big figures · 1.15–1.35 titles · 1.55 prose · prose max-width 70–74ch
tracking: -0.02em headings · -0.03em figures 26px+ · 0.09em labels · 0.1em rail captions
text-wrap: pretty on every paragraph
```

**The figure face** — apply to every number that is money, a count, a percentage, a day count,
a document number or a time:

```css
font-family: 'IBM Plex Mono', monospace;
font-variant-numeric: tabular-nums;
font-weight: 600;
letter-spacing: -0.02em;
```

Big display figures (26–28px) drop to weight 500 and `-0.03em`.

**The label** — above every figure and over every column:

```css
font-size: 11px; font-weight: 700; letter-spacing: 0.09em;
text-transform: uppercase; color: #5f6a7d;
```

### Space, radius, elevation

```
space   2 3 4 6 7 8 9 10 11 12 13 14 16 20 22 40
radius  4 checkbox · 6 section chip · 7 inner segment · 8 button/field · 9 icon chip
        10 phone button · 12 card · 16 frame · 999 pill
shadow  card      0 1px 2px rgba(23,34,60,.05)
        floating  0 18px 44px rgba(23,34,60,.18)
tap     44px minimum on the phone, always
```

### Contrast law

Every text colour above clears 4.5:1 on the grounds it is used on. Two failures the app has
already shipped once and must not ship again: amber ink on an amber fill, and `#ef4b39` as
text. When you add a tinted row or chip, check the pair before you commit it.

---

## 3. Layout

### Desktop frame

```
navy top bar   54px, full width, padding 0 16px, 16px gap
rail           220px, #17223c, padding 14px 10px 16px, 1px gap between rows
work area      flex:1, min-width:0, padding 20px 22px 22px, 14px gap between blocks
```

Order inside the work area, always in this order:

1. **Page header row** — title 19px/700 with a 17px circled `i`, a 12.5px `--ink-3` sub-line
   carrying the screen's position in one sentence; then a spacer, then the screen's controls
   (search 300px, a date range, one secondary button). The primary action lives here only if it
   is the screen's single next action.
2. **A 1px `--divider` rule.**
3. **The position strip** — one white card, 12px radius, 14px 0 padding, 2–4 equal cells
   divided by `1px solid var(--hairline)`, each cell `padding: 0 20px`: label, figure at 26–28px,
   basis line at 11.5px. Never more than four cells, never a figure without a basis.
4. **The work** — the register, the lanes or the queue.

### The two-designs law

**820px is a switch between two designs, not a reflow of one.** Build the desktop and the phone
as two markup paths from one data call. Do not try to make the desktop table become the phone
card by CSS; write the card.

Above 820px the desktop reflows: strip cells drop from four to three to two, side rails move
below the work column under ~1200px, top-bar stage chips shed their labels at 1400px and never
their counts.

### Phone frame (390 × 844)

```
header   navy, padding 11px 13px 0 — wordmark row, then ONE position figure with its basis,
         then the lens tabs (36px, 2px #ef4b39 underline on the active one)
body     padding 12px 13px, 10px gap, cards on the ground
tab bar  58px, white, 1px solid var(--hairline) top, five destinations
```

Phone tab bar active state is a **shape change, not only a colour change**: the glyph sits in a
38×22px `#ffe1dc` pill with a 9.5px/700 `#b2301f` label; the others are stroked 19px glyphs with
9.5px/600 `#5f6a7d` labels.

---

## 4. Navigation

`Rail.dc.html` is the authority. Two laws:

- **The rail is the complete map.** Every destination is reachable without a hover or a guess.
  Groups may fold, and a folded group still shows its count and the row you are on.
- **A badge is drawn only when its number is greater than zero.** Counts that mean "something
  wants you" are pill chips (`#ffe1dc` / `#b2301f`); quiet counts are plain figure-face text in
  `--rail-head`.

Rail row, at rest and active:

```html
<!-- at rest -->
<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;
            font-size:13.5px;font-weight:500;color:#c7cfd8">
  <svg width="16" height="16" …>…</svg>Customers</div>

<!-- the row you are on -->
<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;
            background:#fff;font-size:13.5px;font-weight:700;color:#17223c">
  <svg width="16" height="16" stroke-width="2.2" …>…</svg>
  <span style="flex:1">Invoices</span>
  <span class="figure-face" style="font-size:10.5px;background:#ffe1dc;color:#b2301f;
        border-radius:999px;padding:2px 7px">14</span></div>
```

A group header carries a 22px section chip with the two-letter mark, the name, its count, and a
13px chevron. Sections are separated by a `1px rgba(255,255,255,.09)` rule; `Sign out` sits at
the foot, outside the scroll, above the same rule.

Top bar, left to right: `OW` square (32px, `#c2311f`, radius 9) + `OMNI-WARE` in Archivo Black
16px; breadcrumb (`Sell` in `--rail-meta` / `Invoices` in white 600); a 360px search on
`rgba(255,255,255,.09)` with a `Ctrl K` cap; spacer; the stage-chip group on
`rgba(255,255,255,.07)`; a messages glyph and a settings glyph at 18px `--rail-head`.

---

## 5. Components

### Buttons

```
primary    height 32 · padding 0 13 · radius 8 · #c2311f, white, 12.5px/600 · icon 14px
secondary  height 32 · padding 0 13 · radius 8 · #fff on 1px #cdc9c0, #1b2233
dark       same metrics, #17223c on white text — for a door that is not the next action
ghost      no fill, #5f6a7d, hover #f1efeb
icon       32×32 square, radius 8, 1px #cdc9c0, glyph 15px #5f6a7d
on navy    height 26 · radius 7 · transparent on 1px rgba(255,255,255,.28), white 12px/600
phone      height 44 · radius 10 · 14px/600 · full-width primary, 46px square beside it
```

A button says what will happen and, when money is involved, carries the amount:
**Receive 40,000**, never *Submit*. Nothing sends itself — every send is an owner tap.

### Chips and pills

```
state chip   height 21 · padding 0 9 · radius 999 · 11.5px/600 · tint + ink from §2
figure pill  height 19–20 · padding 0 7 · radius 999 · figure face 10.5px  (e.g. PINV-0198 paid)
voided       neutral chip + text-decoration: line-through
```

### Lens group (the screen's filters)

A 30px track on `#f2efe9`, radius 9, 3px padding, holding 24px segments (radius 7, padding 0 10,
12.5px). The active segment is `#17223c` with white text, or white on `1px #dcdad4` when the
group is a secondary switch. Each segment carries its count in the figure face. **A lens is not a
new screen** — if two screens differ only by a filter, they are one screen with two lenses.

### Register / table

One white card, radius 12, `1px solid var(--hairline)`, `overflow:hidden`, containing in order:

1. **Control line** — lenses left, then the secondary switch, then the sort select. 10px 16px.
2. **Picked bar** — appears only when rows are picked: navy, 9px 16px, stating what is picked and
   its money, with the bulk actions as on-navy buttons and a `Clear`.
3. **Column header** — the grid, `padding 8px 16px`, `background #faf9f6`, labels per §2.
4. **Group header** — `background #f7f5f1`, 8px 16px: the group name 12.5px/700, its count and
   money, and on the right what is shown of what exists (`Showing 5 of 14`).
5. **Rows** — one CSS grid shared by header and rows, `align-items:center`, `column-gap:12px`,
   `padding 11px 16px`, `border-bottom: 1px solid var(--rule)`, hover `--row-hover`.

Row anatomy: checkbox · identity cell (doc number in the figure face over `date · age`) ·
name cell (name 13.5px/600 truncating, with the pills or a plain reason line under it) ·
amounts right-aligned (the figure that matters at 15px, its basis at 11.5px beneath) ·
state chip · **one labelled action plus a 32px overflow**.

Three things a row must never do: carry more than one labelled action; express one ratio twice
(a figure and a bar and a per-cent are the same fact); truncate a figure.

The row that needs the owner gets `border-left: 3px solid #ef4b39` (with the left padding
reduced by 3) and a `#fdf6f4` fill. One row per screen.

### Position strip cell

```html
<div style="padding:0 20px;border-left:1px solid #ecebe6">
  <div style="font-size:11px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#5f6a7d">Still open</div>
  <div style="margin-top:4px;display:flex;align-items:baseline;gap:7px">
    <span class="figure-face" style="font-weight:500;letter-spacing:-0.03em;font-size:28px;line-height:1.1">5,324,000</span>
    <span style="font-size:12px;font-weight:600;color:#5f6a7d">UGX</span></div>
  <div style="margin-top:9px;font-size:11.5px;color:#5f6a7d">On <span class="figure-face" style="font-size:11.5px">14</span> invoices · 9 under 14 days, 4 to 30, 1 past 30</div>
</div>
```

The first cell may carry a 6px three-segment aging bar (radius 999, 2px gaps, the `aging` ramp)
between the figure and the basis line.

### Queue card (a thing that needs you)

White, radius 12, `1px solid var(--hairline)`, 16px padding, `3px` left border — `#5b46d6` when
it can be acted on now, `#c7c3de` when it waits on another. Header: the source chip (`Manager`
in studied tint), the position in the figure face (`01 of 08`), an optional `waits on 01`
neutral chip, then the worth right-aligned as a label over a figure. Title 16.5px/600, reasoning
13px `--ink-3` at 74ch. Actions 32–36px: the one live action, a secondary door, then a ghost
**How this was worked out** that folds the derivation. A card whose work is done shows a `Done`
chip and stops offering the action.

### Phone list card

```html
<div style="background:#fff;border:1px solid #ecebe6;border-left:3px solid #ef4b39;border-radius:12px;padding:12px 13px">
  <!-- identity row: doc number (figure face, accent-ink) · name (flex:1, truncating) · age -->
  <!-- figure row: label + 19px figure left, basis right-aligned -->
  <!-- action row: 44px primary + 46px overflow -->
</div>
```

### Empty, one, and two hundred

Every list states its own emptiness and names the next action
("Nothing wants you this morning. Last read 07:42." + New quote). A truncated list says how many
were cut and offers to show them. Screenshot the empty state before calling a screen done.

### Icons

Lucide, 24 viewBox, `fill:none`, `stroke:currentColor`, `stroke-width:2` (2.2 on an active rail
row, 2.4 on small glyphs inside buttons), round caps and joins. 13–17px in rails and rows,
19px in the phone tab bar. **No emoji anywhere.** No images: every graphic is CSS or inline SVG.

---

## 6. Copy

- Shop language, not accounting language. "Still open", "Receive", "Bought to fill it",
  "What the books flagged". Never "Receivables ageing report".
- A control names its outcome. A heading states a position. A basis line states arithmetic —
  both ends of any comparison, so it can be checked rather than believed
  ("10,000 on 1 May, 13,000 now · across 9 invoices").
- Sentence case everywhere except the 11px labels, which are uppercase by style not by content.
- Currency is `UGX` after the figure, at 12px/600 in `--ink-3`, not baked into the figure.
- Dates read `25 Aug`, ages read `open 23 days`. Never `2026-08-25` in a row a human reads.

---

## 7. Anti-patterns

Do not:

- introduce a colour, radius, font, size or spacing step that is not in §2;
- use `#ef4b39` as a text colour, or put more than one accent-filled control on a screen;
- abbreviate money in a list (`5.3M`), or let a figure truncate or wrap;
- express one ratio more than once (figure + bar + per-cent);
- put more than one labelled action in a table row, or leave an icon action unlabelled outside
  an overflow menu;
- give a screen a second reckoning of a figure another screen already computes — read the one
  reckoning;
- build a new screen for what is a lens on an existing one;
- reflow the desktop table into the phone instead of writing the phone design;
- hide a destination behind a hover, or draw a badge for zero;
- add a tint, a shadow or a rounded container for variety.

---

## 8. Before you say a screen is done

1. What reads first, and why is that right for this screen?
2. What does the owner do here, and in how many taps? Compare with before.
3. Where is the accent, and is it used once?
4. Empty, one row, two hundred rows — screenshot the empty one.
5. At 390px in one hand, is the primary action in the thumb zone and at least 44px?
6. Does every figure carry its basis, and is every figure written in full?
7. Which other screen computes any figure on this one, and are you reading its reckoning?
8. What did you not convert from the old screen, and why?
