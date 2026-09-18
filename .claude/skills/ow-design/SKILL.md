---
name: ow-design
description: The design authority for Omni-Ware. Load this BEFORE designing or building ANY interface — before writing a screen, adding a component, touching CSS, changing a token, or reviewing UI work. It points at the owner's own design system document (DESIGN-SYSTEM.md, beside this file) and adds only what that document cannot know: how the two-designs law is enforced in this codebase, what the tests check, and the order of work when a mockup arrives. If you are about to draw a pixel and you have not read both files in this session, stop and read them.
---

# The design authority

## Two documents sit beside this one, and both are the owner's

**`DESIGN-SYSTEM.md` says what a screen is made of** — tokens, frames,
component recipes, copy rules, anti-patterns. It is the authority on every
value.

**`THE-BRIEF.md` says what a screen is for** — the goal, the eight questions
to answer before designing, the three levels of hierarchy, the required
intelligence layer, and the rule that does the most work of any of them:
**cut duplication, don't just restyle.** It also records where the owner has
overruled the generic brief the design was started from, so nobody
reintroduces blue buttons or an 8px grid.

Read both. A screen built to the tokens but not to the brief is a tidy screen
that does not help anybody decide anything.

## `DESIGN-SYSTEM.md` is the authority on every value.

It sits beside this file. It carries the tokens, the layout frames, the
component recipes, the copy rules and the anti-patterns. **It is not a
summary of the design — it is the design**, written by the owner and handed
over with the reference files.

This file adds only what that document cannot know: how this codebase
enforces the two-designs law, what the tests hold, and what to do when the
document and a reference file disagree.

---

## 1. The mockup is the design

**The owner supplies a mockup per screen. Match it exactly. Do not
reinterpret it.** Rebuilding the same interface in a different language buys
nothing — the old app already works. The design is the thing being bought.

The order of work for any screen:

1. **Ask for the mockup before designing anything.** No mockup for a screen
   yet? Build its domain and its data, and stop. Do not invent a layout to
   fill the gap: it will be thrown away, and worse, it will anchor the
   conversation. `NotBuiltYet` exists to say so on screen.
2. **Read the mockup for its measurements**, not its look — the exact
   colours, sizes, weights, spacing, radii and structure.
3. **The tokens move to meet the mockup**, never the reverse. A value the
   system lacks gets added in `packages/design/src/tokens/`, with its
   contrast pairings, in the same commit. Never hand-code a literal in a
   component, and never round to a token that happens to be close.
4. **Compare before saying it is done.** Screenshot at the mockup's width.
   Differences get named, not quietly kept.

### When the document and a reference file disagree, the FILE wins

DESIGN-SYSTEM.md says so itself: *"When a value is not in here, take it from
the nearest reference file."* This has already mattered three times:

- Its §3 gives a 220px rail and a 54px navy top bar. Every reference file
  draws a **236px rail and a 58px white top bar**, and the Quote handoff
  says so in words. The files win.
- It gives `--bg #f2efe9`, then says either that or `#f6f5f2` is fine, one
  per app. Every reference file uses **`#f6f5f2`**. That is this app's.
- Its prose once called the primary button `#ef4b39`; the markup's `.btn-p`
  is `#c2311f`. The markup was right, and the rule below is why.

### The one thing that never bends

**Contrast.** `#ef4b39` measures 3.66:1 on white — under the floor in *both*
directions, so it can be neither text on light nor a ground under white
text. It is a fill and an icon. `--accent-btn #c2311f` carries white text;
`--accent-ink #b2301f` is accent-coloured type.

If any pairing in a mockup measures under 4.5:1, say so with the
measurement and propose the nearest passing value. Never substitute
silently, and never ship it silently either. This app has already shipped
amber ink on an amber fill once.

---

## 2. The two-designs law is architecture here, not discipline

DESIGN-SYSTEM.md §3 states the law: **820px is a switch between two designs,
not a reflow of one.** This codebase enforces it.

`apps/console/src/desktop/` and `apps/console/src/phone/` are separate
component trees. They share `@ow/domain` and `@ow/data` and **nothing else**.
The switch happens once, in `app/useDesign.ts`. A lint rule forbids
cross-imports, a test fails on one, and the build emits the two as separate
chunks.

**Do not route around this.** A shared component that branches on device
internally is one design wearing two hats, and it drifts to the middle that
serves neither. Duplication between the trees is correct.

Only `app/useDesign.ts` may ask how wide the screen is. Below the switch you
are already inside one design. The desktop may reflow *within itself* — the
strip drops 4→3→2 cells, a side rail moves under the work column at ~1200px,
the stage chips shed labels at 1400px — because the document says it does.
The phone is one width and has no width query at all.

---

## 3. What the tests hold

`pnpm check` runs all of it. The ones that are about design:

**`packages/design/src/tokens/tokens.test.ts`** — every permitted colour
pairing is measured against WCAG; a token in no pairing and no exemption
fails, because nothing would be checking it; the accent is proved unusable
as text in both directions; the meaning families are proved ordered
fill → chip → ink.

**`apps/console/src/architecture.test.ts`** —

- no cross-design imports, either way;
- no width media query inside the phone tree;
- no raw hex and no solid `rgb()` in any component (translucency over navy
  is allowed: no flat token can let the rail show through);
- spacing and type come from a token; dimensions need only be whole pixels;
- every `var(--ow-…)` a stylesheet asks for actually exists — an undefined
  custom property is not an error, it silently inherits, and that shipped
  once as dark body ink on a navy header;
- every `className={s.x}` resolves to a real rule — `undefined` is not an
  error either, and that shipped too;
- at most one accent-filled control per screen.

A test edited to make it pass is a decision to be argued in the commit
message, never a patch.

---

## 4. Seeing the screen

```bash
pnpm --filter @ow/console build
node tools/shoot.mjs /tmp/shots        # desktop 1440 + 1280, phone 390
node tools/deploy-check.mjs            # the built app under the real rewrite
```

`shoot.mjs` fails on any page error. You cannot judge a screen you have not
looked at, and a screen that renders while throwing is not correct.

---

## 5. Before you say a screen is done

DESIGN-SYSTEM.md §8 is the rubric — answer all eight, in writing. The two
this codebase adds:

9. **Is it genuinely two designs**, or one design with two stylesheets?
10. **Which tests pin this screen, and what did you change?** Say what the
    old assertion meant, why it stopped being true, and what the new one
    means.

A report that says "done" is worth nothing.
