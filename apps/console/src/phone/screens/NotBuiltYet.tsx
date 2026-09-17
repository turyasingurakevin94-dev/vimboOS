import type { ReactElement } from 'react';
import s from './NotBuiltYet.module.css';

/** "Not enough is an answer." No mockup yet, so no invented layout. */
export function NotBuiltYet({ name }: { readonly name: string }): ReactElement {
  return (
    <div className={s.wrap}>
      <h1 className={s.title}>{name}</h1>
      <p className={s.body}>
        No design for this screen yet. It still runs in the current app,
        against the same database — nothing has been taken away.
      </p>
    </div>
  );
}
