import type { ReactElement } from 'react';
import s from './NotBuiltYet.module.css';

/**
 * "Not enough is an answer."
 *
 * A screen with no mockup yet says so, and says what still works. It never
 * shows an invented layout to fill the gap — see the second rule in
 * CLAUDE.md. Today is the screen the handoff covers; the rest arrive as
 * their mockups do.
 */
export function NotBuiltYet({ name }: { readonly name: string }): ReactElement {
  return (
    <div className={s.wrap}>
      <h1 className={s.title}>{name}</h1>
      <p className={s.body}>
        No design for this screen yet. It still runs in the current app,
        against the same database — nothing has been taken away. Today is the
        screen this rewrite has reached.
      </p>
    </div>
  );
}
