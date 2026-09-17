# Omni-Ware

A wholesale hardware shop in Uganda. One owner, a phone in a yard in
daylight, a computer on a desk. Every figure on screen is money that is
really theirs.

This is the ground-up rewrite. The old app — a 106,000-line `index.html`
with no build step, holding the entire shop in one in-memory object — is in
`turyasingurakevin94-dev/omni-ware` and still runs the business. **It keeps
running until a screen here is genuinely better.** The database is shared:
same Supabase project, same 95 migrations, same live books.

---

## THE FIRST RULE

> ### Load `.claude/skills/ow-design/SKILL.md` before designing or building ANY interface.
>
> Before writing a screen. Before adding a component. Before touching CSS.
> Before changing a token. Before reviewing UI work. Every time, in every
> session — not once and from memory.
>
> **If you are about to draw a pixel and you have not read it in this
> session, stop and read it.** It is the authority on the palette, the
> two-designs law, the meaning rules and the review rubric. It is not a
> style guide to consult when unsure; it is the specification.

The user asked for this explicitly and it is the standing rule of the
project. A screen built without it is rework, however good it looks.

---

## The core objective

**User experience, above everything else.** Not feature count, not fidelity
to a mockup, not implementation cleverness. Every screen is a
decision-making workspace, not a place that displays data. The person should
know what matters, what needs attention and what to do next — within three
seconds.

Every screen surfaces 3–5 actionable insights automatically. See §5 of the
design skill.

---

## The two-designs law, in one paragraph

**The desktop is a dense work console. The phone is its own application.
900px is a switch between two designs, not a reflow of one.** Tablet and
laptop are the desktop design. `apps/console/src/desktop/` and
`apps/console/src/phone/` are separate component trees sharing only
`@ow/domain` and `@ow/data`; a lint rule forbids cross-imports. Duplication
between them is correct. A shared component that branches on device
internally is the thing this law forbids.

---

## Architecture

```
packages/domain    pure business types and rules. No UI, no I/O, no React.
packages/data      Supabase client, typed queries, mutations. No UI.
packages/design    tokens, primitives, the design system as code.
apps/console/src/
  app/             providers, auth, and the ONE device switch
  desktop/         the desktop application
  phone/           the phone application
```

Three things the old architecture got wrong, and what replaces them:

1. **No build step** → Vite, ES modules, code splitting per route.
2. **The whole database in one in-memory object, diff-synced on every save**
   → per-screen queries through TanStack Query. The client holds what the
   screen needs and nothing else.
3. **106k untyped lines** → strict TypeScript, `noUncheckedIndexedAccess`
   and `exactOptionalPropertyTypes` on.

## The two laws that live in the type system

Read `packages/domain/src/` before writing business logic.

- **`Money`** is a branded integer of shillings. No `+`, no silent fraction.
  Every operation that could produce one says how it rounds. `allocate`
  hands out the remainder a shilling at a time so a split always sums back.
- **`Derived<T>`** is `known` | `partial` | `unavailable`. You cannot read
  the value without handling all three. **Absence is not zero.** A total
  built from a partial input is partial; a total missing an input cannot be
  derived at all.

These are the old app's design laws, which held right up until someone wrote
`total || 0`. They are types now so they cannot be forgotten.

---

## Commands

```bash
pnpm install
pnpm dev          # the console, on Vite
pnpm check        # typecheck + lint + test — run before you say you are done
pnpm vitest run   # tests alone
```

## Conventions

- Comments explain **why**, never what. If a line needs a comment to say what
  it does, rename something instead.
- A test edited to make it pass is a decision to be argued in the commit
  message, never a patch.
- Commit messages say what changed and why it was wrong before.
- No raw hex in components. `var(--ow-color-*)` or the token, always.
