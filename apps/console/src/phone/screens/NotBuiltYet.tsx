import type { ReactElement } from 'react';
import s from './NotBuiltYet.module.css';

/** "Not enough is an answer." Says what is not here, and what still works. */
export function NotBuiltYet({ name }: { readonly name: string }): ReactElement {
  return (
    <div className={s.wrap}>
      <h1 className={s.title}>{name}</h1>
      <p className={s.body}>
        Not rebuilt yet. It still runs in the current app, against the same
        database — nothing has been taken away. Today is the screen this
        rewrite has reached.
      </p>
    </div>
  );
}
