# Omni-Ware

> The repository is `vimboOS`; the product inside it is **Omni-Ware**. The
> package scope is `@ow/*`. Nothing depends on those names matching.

Order, stock and money management for a wholesale hardware shop in Uganda.
One owner, a phone in a yard in daylight, a computer on a desk. Every figure
on screen is money that is really theirs.

This is the ground-up rewrite. The app currently running the business lives
in [`omni-ware`](https://github.com/turyasingurakevin94-dev/omni-ware) and
keeps running until a screen here is genuinely better. **Both read the same
Supabase database**, so the cutover is per-screen rather than all at once.

---

## Getting started

```bash
pnpm install
cp .env.example .env.local     # add the staging publishable key
pnpm dev                       # the console, on Vite
pnpm check                     # typecheck + lint + test — before you push
```

Node 22+, pnpm 10+.

## Layout

```
packages/domain    business types and rules. No UI, no I/O, no React.
packages/data      Supabase client, the row-to-domain boundary, queries.
packages/design    tokens and the design system as code.
apps/console/src/
  app/             providers, auth, and the ONE device switch
  desktop/         the desktop application
  phone/           the phone application
```

## The three decisions worth knowing

**1. The desktop and the phone are two applications, not one responsive
layout.** 900px is a switch between them. They share `@ow/domain` and
`@ow/data` and nothing else; a lint rule and a test forbid cross-imports,
and the build emits them as separate chunks. Duplication between the two
trees is correct. Tablet and laptop are the desktop design.

**2. Two of the old app's design laws are types now.** `Money` is a branded
integer of shillings — no `+`, no silent fraction, and `allocate` hands out
the remainder so a split always sums back. `Derived<T>` is `known` |
`partial` | `unavailable`, and there is no way to read the value without
handling all three. **Absence is not zero.** A total built from a partial
input is partial; one missing an input cannot be derived at all.

Both were rules in a document in the old app, and both held right up until
someone wrote `total || 0` — which turned a missing supplier price into a
margin of 100%.

**3. Staging is the default and production takes an explicit opt-in.** The
old app defaults unknown hosts to production, deliberately: a half-finished
switch there would have pointed the live shop at an empty database. This app
defaults the other way for the opposite reason — nothing here has earned the
real books yet, and a screen that is wrong about staging costs nothing.

## The design system

`.claude/skills/ow-design/SKILL.md` is the authority: the palette, the
two-designs law, the meaning rules, the component anatomy and the review
rubric. **Read it before designing or building any interface.** It is the
first rule in `CLAUDE.md` and it is not a formality.

Mechanically enforced by `packages/design/src/tokens/tokens.test.ts` (every
permitted colour pairing is measured against WCAG; the weakest is 5.11:1)
and `apps/console/src/architecture.test.ts` (no cross-design imports, no raw
hex, no pixel off the ramp, one accent per screen).

## Looking at a screen

```bash
pnpm --filter @ow/console build
node tools/shoot.mjs /tmp/shots     # desktop 1440 + 1280, phone 390
```

Fails on any page error. You cannot judge a screen you have not looked at,
and a screen that renders while throwing is not correct.

## What is built

Today, in both designs, on demonstration data in the shapes the live queries
return. Everything else still runs in the current app. The boundary that
turns database rows into domain types is done and tested; the queries that
use it are next.
