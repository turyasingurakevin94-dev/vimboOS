/**
 * Today — the phone. Screen 2b of the Today handoff.
 *
 * The same content as the console, less air: move cards at 10/11 padding,
 * the worth as an inline chip rather than a block, one reason line rather
 * than a paragraph, and Yesterday reduced to two tiles.
 *
 * Nothing here imports from `../../desktop/`, and a lint rule plus a test
 * would both stop it.
 */

import type { ReactElement } from 'react';
import s from './Today.module.css';
import { Mark, PATH } from '../icons.js';

const v = (t: string): string => `var(--ow-color-${t})`;

const MOVES = [
  {
    chip: 'Manager 01',
    worth: '3,330,000 tied · 44d',
    worthFill: v('bad-fill'),
    worthInk: v('bad-ink'),
    title: 'Ask Mulongo Hardware for a deposit before the next delivery',
    why: 'Five chases since 2 Aug produced nothing',
    act: 'Draft the chase',
    actIcon: PATH.message,
  },
  {
    chip: 'Manager 02',
    worth: '+1,180,000 a month',
    worthFill: v('good-chip-light'),
    worthInk: v('good-ink'),
    title: 'Raise iron sheets G28 by 4% — still selling at May’s cost',
    why: 'Kampala Steel billed 13,000 on 20 July against 10,000 on 1 May',
    act: 'Open prices',
    dark: true,
  },
  {
    chip: 'Manager 03',
    worth: '7,400,000 at risk',
    worthFill: v('neutral-chip'),
    worthInk: v('neutral-ink'),
    waiting: true,
    title: 'Order 40 boxes of G28 before Friday',
    why: 'Six days of cover · needs 9,600,000 against 8,420,000 held',
    act: 'Open forecasts',
  },
] as const;

const WATCH = [
  {
    icon: PATH.clock,
    chip: v('bad-chip'),
    ink: v('bad-ink'),
    first: 'Nakawa Traders has owed 74 days',
    second: 'Invoiced 5 July, part-paid 18 July',
    fig: '2,410,000',
    figInk: v('bad-ink'),
  },
  {
    icon: PATH.box,
    chip: v('warn-chip'),
    ink: v('warn-ink'),
    first: '7 lines run out within 10 days',
    second: '14,200,000 to refill against 8,420,000 held',
    fig: '5,780,000 short',
    figInk: v('warn-ink'),
  },
  {
    icon: PATH.up,
    chip: v('bad-chip'),
    ink: v('bad-ink'),
    first: 'Kampala Steel is billing 30% more',
    second: '10,000 on 1 May, 13,000 now · 9 invoices',
    fig: '+30%',
    figInk: v('bad-ink'),
  },
  {
    icon: PATH.users,
    chip: v('info-chip'),
    ink: v('info-ink'),
    first: 'Nsubuga sells at 11% against 19%',
    second: '344,000 commission on 3,100,000 sold',
    fig: '−8 pts',
    figInk: v('warn-ink'),
  },
  {
    icon: PATH.layers,
    chip: v('owed-chip'),
    ink: v('ink-2'),
    first: '3,100,000 has not moved in 120 days',
    second: '9 lines · oldest bought 14 March',
    fig: '3,100,000',
  },
] as const;

export function Today(): ReactElement {
  return (
    <>
      <div className={s.sectionHead}>
        <span className={s.sectionTitle}>What to do today</span>
        <span className={s.sectionNote}>3 moves · 5 flags</span>
      </div>

      {MOVES.map((m) => (
        <article
          key={m.chip}
          className={`${s.card} ${s.move} ${'waiting' in m ? s.moveWaiting : ''}`}
        >
          <div className={s.moveTop}>
            <span
              className={s.chip}
              style={{ background: v('study-chip'), color: v('study-ink') }}
            >
              {m.chip}
            </span>
            <span
              className={`${s.chip} ${s.worth}`}
              style={{ background: m.worthFill, color: m.worthInk }}
            >
              {m.worth}
            </span>
          </div>
          <h2 className={s.moveTitle}>{m.title}</h2>
          <p className={s.moveWhy}>{m.why}</p>
          <div className={s.moveActions}>
            <button
              type="button"
              className={`${s.primary} ${'dark' in m ? s.dark : ''}`}
            >
              {'actIcon' in m && <Mark d={m.actIcon} size={16} />}
              {m.act}
            </button>
            <button type="button" className={s.door} aria-label="Open">
              <Mark d={PATH.arrow} size={18} />
            </button>
          </div>
        </article>
      ))}

      <section className={`${s.card} ${s.watch}`} aria-label="What the books flagged">
        <div className={s.watchHead}>
          <span className={s.watchTitle}>What the books flagged</span>
          <span className={s.watchNote}>five of five</span>
        </div>
        {WATCH.map((a) => (
          <button type="button" className={s.watchRow} key={a.first}>
            <span
              className={s.watchIcon}
              style={{ background: a.chip, color: a.ink }}
              aria-hidden="true"
            >
              <Mark d={a.icon} size={14} />
            </span>
            <span className={s.watchBody}>
              <span className={s.watchFirst}>{a.first}</span>
              <span className={s.watchSecond}>{a.second}</span>
            </span>
            <span className={s.watchFig} style={{ color: 'figInk' in a ? a.figInk : undefined }}>
              {a.fig}
            </span>
          </button>
        ))}
      </section>

      {/* Yesterday reduces to two tiles on the phone. */}
      <section className={`${s.card} ${s.yesterday}`}>
        <span className={s.watchTitle}>Yesterday</span>
        <div className={s.tiles}>
          <div className={s.tile} style={{ background: v('surface-2') }}>
            <div className={s.tileLabel}>Sold</div>
            <div className={s.tileFig}>4,186,000</div>
          </div>
          <div className={s.tile} style={{ background: v('good-fill') }}>
            <div className={s.tileLabel}>Collected</div>
            <div className={s.tileFig} style={{ color: v('good-ink') }}>
              2,940,000
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
