# The brief — how a screen gets redesigned

`DESIGN-SYSTEM.md` says what a screen is made of. This says **what a screen is
for**, and how to decide what goes on it.

It is the owner's own instruction to Claude design, recorded here so that every
screen — designed there or built here — is held to the same standard, and so
that nobody has to guess what "good" meant on the screens that came before.

> **We are improving the current system, not redoing it.** The old app runs a
> real shop and has been right about a great many things for years. A redesign
> that loses one of them is not an improvement, whatever it looks like.

---

## The goal

**Every screen is a decision-making workspace, not a place that displays data.**

The person knows what matters within **three seconds**. The interface is calm,
fast and professional. Every pixel earns its place.

Design each page **from first principles** — not from the layout it currently
has. Rebuilding the old screen in new paint buys nothing.

---

## Before designing anything, answer these eight

1. What is the person's primary goal on this page?
2. What decision are they making?
3. What information must appear first?
4. What is secondary?
5. Which actions happen most often?
6. Where is the friction today?
7. What hidden insight can be surfaced automatically?
8. What can be progressively disclosed rather than always visible?

Then design around the answers, not around the old screen.

---

## Three levels, and only three

| Level | What it holds | How it appears |
| --- | --- | --- |
| **1 — Critical** | what is owed, what is at risk, what is due, who it is | dominates the page |
| **2 — Decision support** | trends, comparisons, history, margin | visible, secondary |
| **3 — Supporting detail** | everything else | expandable cards, slide-overs, drawers — never a long scroll |

---

## Cut duplication, don't just restyle

**Look for pages, panels and figures that duplicate something else, and propose
merging them.** When you do, name three things:

1. **what is lost** — honestly, including the thing somebody will miss;
2. **what absorbs it** — the screen that takes the work;
3. **how the words people search by still reach it** — the old screen's name is
   what somebody types, and it has to land somewhere sensible.

This is not a tidiness exercise. It is the single biggest improvement available,
and this project already has the proof:

- **Customers and Debtors were one screen wearing two hats.** A debtor is a
  customer with a balance. Keeping both meant `renderCustomers()` and
  `renderDebtorsList()` had to be called together after every payment, and the
  morning one was missed the two screens disagreed about the same debt.
- **"Build a new screen for what is a lens on an existing one" is a named
  anti-pattern** in DESIGN-SYSTEM.md §7, and lenses are how Messages, Invoices
  and Customers all work now.
- **The search already does the third part.** Typing *payout* lands on Agents
  and scrolls to the figures the cut screen used to show — `asksForBonus` in the
  rail. A merged screen without that is a screen somebody cannot find.

The same rule applies to figures, not just pages: **a screen never grows a
second reckoning of a figure another screen already computes.** Read the one
reckoning.

---

## The intelligence layer — required

**Every screen automatically surfaces 3–5 actionable insights.** Not a chart
that could be read into; a thing worth knowing, stated.

Replace raw data with the decision it supports:

> not `Supplier A`
> but `Supplier A · cheapest today · saves 42,000 · 94% delivered on time`

Worked examples the brief gives: cash runway and overdue invoices for money,
days of stock and dead stock for inventory, the current bottleneck and overdue
actions for orders, lifetime value and outstanding balance for a customer.

**An insight this app cannot yet derive is named, not faked.** Today's "What the
books flagged" says *"2 of 5"* and lists the three readings it cannot make. Four
confident rows under a caption promising five would be a quieter lie than the
hard-coded sentences it replaced.

---

## Scanning, not reading

Design for scanning: icons, chips, bold figures, clear grouping — not
paragraphs. A card answers **exactly one question** — *what happened*, *what
needs attention*, or *what should I do next* — and never mixes unrelated
information.

**Avoid explanatory text wherever hierarchy, spacing, an icon or a colour says
the same thing.**

> **This does not touch the basis line, and the difference matters.** A basis
> line is not an explanation, it is **arithmetic** — *"94% of 86,998,995 raised
> on 155 invoices"*. Hierarchy cannot say that; only the numbers can, and
> DESIGN-SYSTEM.md requires them under every figure. What the rule forbids is
> prose that restates what the layout already shows: a paragraph explaining that
> the red row is urgent, a caption under a chip repeating the chip.
>
> The test: **could hierarchy, an icon or a tint carry this?** If yes, cut the
> words. If it is a figure being interrogated, keep them.

Two places prose is allowed, both earned: the sentence before an irreversible
commit (*"No money is received and nothing is charged"*), and a screen stating
its own emptiness (*"Nothing in the books wants you this morning"*).

---

## Where this brief is overruled

The brief was written for enterprise SaaS in general. **`DESIGN-SYSTEM.md` wins
wherever they disagree**, and the owner has ruled on these:

| The generic brief says | This project does |
| --- | --- |
| Blue for primary actions | **`--accent-btn #c2311f`**, once per screen. Blue is `info`, a meaning tint, and never a button. |
| An 8px grid | **The named space tokens.** `--ow-space-*`, which are not a multiple of anything. |
| "Animated counters", decorative polish | A figure is never decorated. Movement only where it explains a state change. |

Everything else in the brief stands.

---

## What a finished design hands over

1. **UX audit** — the friction today, what is being missed, where the overload is.
2. **First-principles strategy** — the new interaction model, in words.
3. **The mockup** — real component recipes, realistic figures.
4. **Component breakdown** — what is reusable, and what already exists.
5. **Interaction notes** — hover, click, inline edit, responsive, empties.
6. **The intelligence layer** — which 3–5 insights the screen now surfaces, and
   which it cannot yet derive.

Then §8 of `DESIGN-SYSTEM.md` — the eight questions — before calling it done.
