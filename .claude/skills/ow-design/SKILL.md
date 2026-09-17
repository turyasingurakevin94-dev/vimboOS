---
name: ow-design
description: The house design system for Omni-Ware — the tokens, the two-designs law, the meaning rules, the component anatomy and the review rubric. Load this BEFORE designing or building ANY interface: before writing a screen, before adding a component, before touching CSS, before changing a token, and before reviewing someone else's UI work. This is the authority, not a suggestion. If you are about to draw a pixel and you have not read this file in the current session, stop and read it.
---

# The Omni-Ware design system

This is a wholesale hardware shop in Uganda. One owner, a phone in a yard in
daylight, and a computer on a desk. Every figure on screen is money that is
really theirs. Nothing here is decoration.

**Read this whole file before you draw or build.** Then run
`pnpm vitest run packages/design` — it enforces mechanically as much of this
as a test can reach, and it is not optional.

---

## 0. The objective, above everything else

**The user experience is the core objective.** Not feature count, not how
clever the implementation is. Every decision in this file resolves toward one
question: *does the person in front of this screen know what matters, what
needs attention, and what to do next?*

Matching the owner's mockup (§0.5) is not in tension with that — the mockup
IS their answer to that question, for their own shop and their own working
day. Building it faithfully is how the objective is served, not a detour
around it. Where a mockup would genuinely fail the person using it — a
pairing under the contrast floor, a target too small for a thumb in a yard —
name it, show the measurement, and propose the smallest change that fixes
it. Never deviate silently.

If a rule in this file ever obstructs the objective, the rule is wrong and
should be argued with in a commit — not quietly ignored.

---

## 0.5 The mockup is the design

**The owner supplies a mockup for each screen, generated in Claude design.
Match it exactly. Do not reinterpret it.**

This is the point of the rewrite. Rebuilding the same interface in a
different language buys nothing — the old app already works. What is being
bought is the *design*, and the mockup is the design. A screen that is
"in the spirit of" the mockup is a screen the owner now has to argue with.

So the order of work for any screen is:

1. **Ask for the mockup before designing anything.** If there is no mockup
   for a screen yet, build the domain and the data for it and stop. Do not
   invent a layout to fill the gap — it will be thrown away, and worse, it
   will anchor the conversation.
2. **Read the mockup for its measurements**, not just its look: the exact
   colours, type sizes, weights, spacing, radii, and the structure of every
   component on it.
3. **Reconcile it with the tokens, in that direction.** Where the mockup uses
   a value the system does not have, **the token system moves to meet the
   mockup** — add the value in `tokens/`, with its contrast pairings, in the
   same commit. Never hand-code a literal in a component to match a mockup,
   and never bend the mockup to a token that happens to be close. The system
   exists to make the mockup repeatable, not to overrule it.
   The one thing that does not bend is the contrast floor: if a pairing in a
   mockup measures below 4.5:1, say so, show the measurement, and propose the
   nearest value that clears it.
4. **A mockup is one design.** The two-designs law still holds, so each
   screen needs a desktop mockup and a phone mockup. Given only one, build
   that one and ask for the other rather than deriving it — a derived phone
   layout is the responsive compromise wearing a disguise.
5. **Compare before saying it is done.** Screenshot the built screen at the
   mockup's width and put the two side by side. Differences get named, not
   quietly kept.

Everything below this section still applies — it is how the mockup gets
BUILT, not a second opinion about how it should look.

---

## 1. The two-designs law

**The desktop is a dense work console. The phone is its own application.
900px is a SWITCH between two designs, not a reflow of one.**

The owner rejected an earlier attempt in these words: *"wanting to fit both
on phone and desktop have made you design a very boring desktop app… let it
be slightly dense and professional."* They were right. A layout that serves
both serves neither.

**Tablet and laptop are the desktop design.** They are a pointer, a keyboard
and a wide screen, which is what that design is for. There is no third
design and nothing in between.

### It is architecture, not discipline

`apps/console/src/desktop/` and `apps/console/src/phone/` are separate
component trees. They share `@ow/domain` and `@ow/data` and **nothing else**.
The switch happens once, at the root. A lint rule forbids either tree from
importing the other, and a test fails if one appears in the other's bundle.

You cannot accidentally write a responsive compromise here, because there is
no file that both designs render from. **Do not try to route around this.**
A shared "smart" component that branches on device internally is the exact
thing the law forbids — it is one design wearing two hats, and it will drift
toward the middle that serves neither.

Duplication between the two trees is **correct** and expected. Two designs
means two implementations.

### What each design is

| | Desktop (≥900px) | Phone (<900px) |
|---|---|---|
| body type | 13px | **15px** |
| meta type | 11px | 13px |
| row padding | 10 / 12px | 14 / 16px |
| page padding | 24px | 16px |
| tap target | 32px | **44px** |
| chrome | dark rail 232px + 56px top bar | 52px top bar + 60px tab bar |
| a queue | dense table, 40px rows, expand in place, bulk select | cards, actions on the card, no bulk anything |
| metrics | one horizontal strip, hairline dividers, no per-tile borders | a 2×2 block in one card |
| context | a 320px right column, beside the work | below the work, or behind a sheet — never beside |
| an action | button in the page header + a keyboard shortcut | full-width button in the thumb zone |
| detail | a slide-over; the list stays behind it | a full-screen push; the list is gone |
| editing | inline in the table — click, type, tab | a dedicated form screen |

**The phone's type is LARGER, not smaller.** The reflex on a small screen is
to shrink everything. Outdoors, at arm's length, in sunlight, one-handed,
the phone needs the bigger type. A test asserts this, because the reflex is
strong.

`packages/design/src/tokens/device.ts` holds these as data. Read the design
you are building and ignore the other one.

---

## 2. Colour

**The palette is the 24 values in `tokens/color.ts`. Never introduce a 25th.**
Components read `var(--ow-color-*)`; a hand-typed hex is how a 25th is born,
and a lint rule rejects one.

### The one structural rule

**The accent is cool. The states are warm.**

The old system had a red accent sitting beside a crimson "bad" and an amber
"caution" — three warm colours doing three different jobs. A red thing on
screen might mean *do this next* or *this is broken*, and the only way to
tell was to read it.

Here:

- **Blue (`accent`) means "the one action", and nothing else.**
- **Warm (`good` / `warn` / `bad`) means "something about this figure", and
  nothing else.**

They can never be confused, because they are not the same temperature. A
test asserts the accent stays in the blue arc and the states stay warm. If
you find yourself wanting a warm accent, you are about to re-break this.

### The contrast floor

Every ink on every ground clears **4.5:1** (3:1 at ≥20px, or ≥14px bold, or
for the boundary of a control). The weakest pairing in the system is 5.11:1,
and a test holds the floor at 4.8 so that a pairing is never one rounding
decision from failing.

`legalPairings` in `tokens/color.ts` is the list of permitted combinations
**and the input to that test**. Adding a colour without adding its legal
grounds means nothing checks it — so a separate test fails if any token
appears in no pairing and no exemption. **If you add a colour, you add its
pairings in the same commit.**

The old app shipped dark amber ink on a red fill — the worst pairing there
is on a phone in daylight — and nothing caught it, because the palette was a
comment. That is why this is computed.

### The meaning rules — the part a test cannot enforce

- **Colour only where it means something.** A device that marks everything
  marks nothing. Six card classes in the old app carried the same red rail
  and it signalled precisely nothing.
- **The accent appears ONCE per screen.** It is the one thing to do next. If
  you have two accent elements, one of them is wrong. (The rail's active row
  is *inverted*, not accented, for exactly this reason: an accent there
  would spend the screen's one accent on a row you are already standing on.)
- **A figure is a size, not a warning.** Money on a row is ink. `bad` is for
  the genuinely bad — overdue, a loss, behind target. `good` for the
  genuinely good. Everything else is ink.
- **Never invent a state.** good / caution / bad. There is no fourth.
- **Never rely on colour alone.** A state carries a word or a shape as well.
  Roughly 1 in 12 men cannot separate your green from your red, and daylight
  on a cheap screen defeats the rest.

---

## 3. Type

**Two faces. Four weights. One ramp.**

- **Inter** — the interface, including page titles. Weights 400/500/600/700.
- **IBM Plex Mono** — every figure. Weights 400/500/600.

Only those four weights are loaded. A fifth gets faked by the browser, which
is why some headings in the old app looked muddy. A test asserts there are
four.

**Sizes come off the ramp** (11/12/13/14/15/16/18/20/24/30) and there are no
half-pixel sizes. The old file reached 33 font sizes in half-pixel steps;
that is the disease, and it starts with one reasonable-looking 12.5.

### Money is a component, not a span

Any figure the shop could act on renders through `<Figure>`, which applies:

```
font-family: IBM Plex Mono
font-variant-numeric: tabular-nums
letter-spacing: -0.02em
```

Tabular is the load-bearing one — a column of money that does not line up
cannot be scanned, and scanning is the only way a column of money is read.
Right-aligned in every table. Figure, then unit, then basis, in that fixed
relationship.

**Every prose block gets a measure** (`--ow-measure`, 72ch). On a 1660px
screen an unmeasured paragraph runs 180 characters.

---

## 4. Space, radius, elevation

A **4px grid stepping in 8s**. 2 and 6 exist for the inside of a chip and
the gap between a figure and its unit; everything else is a multiple of 4.

Radius: 6 chip · 8 button/field/nav row · 12 card · 16 modal · 999 pill.

**Elevation is four named steps and each one says what floats at it** —
`rest` (a card), `raised` (hover, sticky header), `float` (menu, toast),
`modal`. They are soft and low on purpose. A shadow here is depth, never
decoration; anything heavier reads as a dialog and makes the page feel like
a pile of loose paper.

**The focus ring is never removed.** It is the whole of keyboard navigation
for someone who lives in this app all day.

---

## 5. Every screen surfaces what matters

**This is the rule that separates this app from a database viewer.**

Every screen automatically surfaces **3–5 actionable insights**. Not raw
data — the reading of it. The person should understand what matters within
**three seconds** of the screen appearing.

Instead of `Supplier A`, show *Supplier A — cheapest today, saves UGX 42,000,
94% on-time*. Instead of `Inventory`, show *3 items run out today · 12
overstocked · supplier delay on G28 sheets*.

| screen | what it must surface without being asked |
|---|---|
| Product | cheapest supplier today · price trend · stock risk · next reorder |
| Customer | lifetime value · outstanding balance · buying frequency · what they buy next |
| Supplier | price competitiveness · reliability · delivery delays · savings available |
| Orders | the current bottleneck · overdue actions · margin · expected completion |
| Inventory | days of stock left · fast movers · dead stock · reorder urgency |
| Finance | cash runway · overdue invoices · biggest expense driver · margin trend |

**Every insight is a `Derived<T>` and shows its basis.** Which brings us to
the rules that outrank the visual system entirely.

---

## 6. The laws about meaning

These are permanent, they are enforced by types and tests, and the interface
must never contradict them.

- **Derived, never invented.** Every figure comes from the books. A figure is
  `known`, `partial` or `unavailable` (`@ow/domain`), and the compiler will
  not let you render one without saying what happens in all three cases.
  **Absence is not zero.** A screen that cannot derive a number says so,
  and says why, instead of showing one.
- **Doubt is contagious.** A total built from a partial input is partial. A
  total missing an input cannot be derived at all. Never present a confident
  figure built on a gap.
- **Nothing sends itself.** Every send, order and payment is a deliberate
  tap. A screen must never look like it already acted.
- **A failure must name itself.** No silent empty state where something went
  wrong — say what failed and what to do.
- **Named rather than dropped.** A truncated list says how many were cut.
  Missing data is reported, never treated as zero.
- **Not enough is an answer.** An empty screen that says "nothing yet" and
  names the next action beats a screen that pretends.

Copy follows: a control says what will happen ("Draft the chase", not
"Submit"). An empty state names the next action. An error says what went
wrong and how to fix it.

---

## 7. Text that will not fit

A shop's real data is longer than the box you drew. "Ssekitoleko Hardware",
"Iron sheets — G28, 3m box profile".

1. **An `<input>` cannot ellipsis.** It clips mid-glyph with no marker and no
   tooltip. A value that can exceed its box must not sit in a bare input:
   size the field for the longest realistic value, or render it as text until
   it is focused. In the old app "Mulongo Hardware" showed as "Mulongo
   Hardwar" — which reads as a different supplier, not as a truncation.
2. **Truncation is three declarations, never two:** `overflow:hidden;
   text-overflow:ellipsis; white-space:nowrap`. All three or none. And a
   truncating element inside a flex or grid parent needs **`min-width:0`**,
   or it refuses to shrink and shoves its neighbours out of the box instead.
   Carry the full value in a `title`.
3. **Money never truncates.** Figure columns are sized to their content and
   the text columns give way. A clipped figure is not a shortened figure, it
   is a WRONG figure — "1,240,00" is a tenth of "1,240,000" and looks
   entirely plausible. **If something must be cut, cut the name.**

---

## 8. Icons

24 viewBox, `fill:none`, `stroke:currentColor`, **stroke-width 1.75**, round
caps and joins. 16px in dense desktop rows, 20px in phone lists, 24px in the
phone tab bar.

**Never emoji.** Draw the mark.

In the phone tab bar the **active state is FILLED and the inactive is
stroked** — a shape change reads at a glance where a colour change alone
does not, and it survives both daylight and colour blindness.

Draw marks that mean something in this shop rather than borrowing a generic
set.

---

## 9. Before you say you are done

Run these, and paste the output:

```bash
pnpm vitest run          # the ratchet, including the contrast test
pnpm typecheck
pnpm lint                # includes the no-raw-hex and no-cross-design rules
```

Then **look at the screen** — at 1440px and at 390px, both, with real-length
data in it. You cannot judge a screen you have not seen.

Then answer the rubric:

1. **What reads first**, and why is that right for this screen?
2. **What are the 3–5 insights this screen surfaces?** Could the owner have
   found them without it?
3. **What does the owner do here, and in how many taps?**
4. **Where is the accent, and is it used exactly once?**
5. **Empty, one row, two hundred rows** — screenshot the empty one.
6. **At 390px in one hand** — is the primary action in the thumb zone?
7. **Is this genuinely two designs**, or one design with two stylesheets?
8. **Which tests pin this screen, and what did you change?** A test edited to
   pass is a decision to be argued, never a patch. Say what the old assertion
   meant, why it stopped being true, and what the new one means.

A report that says "done" is worth nothing.
