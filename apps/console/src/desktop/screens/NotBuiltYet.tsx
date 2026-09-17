import type { ReactElement } from 'react';
import s from './NotBuiltYet.module.css';

/**
 * "Not enough is an answer."
 *
 * An empty screen that says what is not here yet, and what does work,
 * beats a screen that pretends. This is a placeholder for sections the
 * rewrite has not reached — it never pretends to be a loading state, and
 * it never shows an empty table as if the shop had no customers.
 */
export function NotBuiltYet({ section }: { readonly section: string }): ReactElement {
  return (
    <div className={s.wrap}>
      <h1 className={s.title}>{section[0]?.toUpperCase()}{section.slice(1)}</h1>
      <p className={s.body}>
        This section has not been rebuilt yet. It still runs in the current
        app, against the same database — nothing here has been taken away.
        Today is the screen this rewrite has reached.
      </p>
    </div>
  );
}
