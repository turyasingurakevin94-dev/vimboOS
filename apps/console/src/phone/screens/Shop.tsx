/**
 * Setup › The shop › WhatsApp, on the phone — frame 3b.
 *
 * The connection that was never made, as one card. The promise comes first:
 * the real reason a shop does not link is the fear that it breaks the number
 * the business runs on, and that sentence is the only thing on the screen
 * that answers it.
 *
 * The three lines under it are in the FUTURE tense. You do not tabulate the
 * absence of things that were never switched on — the live app's three
 * *none · none · not available* rows become three things the shop would
 * actually get, each with the figure it already has.
 */

import { type ReactElement } from 'react';
import { CATALOGUE_WITH_PHOTO_AND_PRICE, PICKED_LIST_SIZE } from '@ow/data';
import s from './Shop.module.css';
import { Mark, PATH } from '../icons.js';

const TURNS_ON: readonly {
  readonly icon: string;
  readonly title: string;
  readonly say: ReactElement;
}[] = [
  {
    icon: PATH.bubble,
    title: 'Read and answer chats here',
    say: <>With the account and the debt beside them</>,
  },
  {
    icon: PATH.bag,
    title: 'Let customers browse what you sell',
    say: (
      <>
        The <span className={s.turnFig}>{CATALOGUE_WITH_PHOTO_AND_PRICE}</span> products with a
        photo and a price
      </>
    ),
  },
  {
    icon: PATH.send,
    title: 'Send one message to a picked list',
    say: (
      <>
        A price change to the <span className={s.turnFig}>{PICKED_LIST_SIZE}</span> who buy that
        line
      </>
    ),
  },
];

export interface SetupProps {
  readonly linked: boolean;
  readonly onBack: () => void;
  readonly onLink: () => void;
}

export function Setup({ linked, onBack, onLink }: SetupProps): ReactElement {
  return (
    <div className={s.screen}>
      <header className={s.header}>
        <div className={s.headTop}>
          <button type="button" className={s.back} onClick={onBack} aria-label="Back">
            <Mark d={PATH.back} size={18} />
          </button>
          <span className={s.title}>WhatsApp</span>
          <span className={s.chip}>{linked ? 'linked' : 'not linked'}</span>
        </div>
      </header>

      <div className={s.body}>
        <p className={s.promise}>
          <strong>Linking changes nothing on your phone.</strong> The same number keeps
          working there, chats keep arriving as they do now, and Omni&#8209;Ware starts
          seeing them too.
        </p>

        <div className={s.section}>
          <div className={s.label}>
            {linked ? 'What linking turned on' : 'What linking would turn on'}
          </div>
          <div className={s.turnsOn}>
            {TURNS_ON.map((t) => (
              <div key={t.title} className={s.turn}>
                <span className={s.turnMark}>
                  <Mark d={t.icon} size={15} />
                </span>
                <div className={s.turnBody}>
                  <div className={s.turnTitle}>{t.title}</div>
                  <div className={s.turnSay}>{t.say}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={s.locked}>
          <span className={s.lockIcon}>
            <Mark d={PATH.lock} size={15} />
          </span>
          <p className={s.lockedSay}>
            Nothing leaves the shop until you press send, and linking does not change that.
          </p>
        </div>
      </div>

      {!linked && (
        <div className={s.foot}>
          <button type="button" className={s.primary} onClick={onLink}>
            Link the number
          </button>
          <div className={s.cost}>About ten minutes · the phone in your hand</div>
          <button type="button" className={s.secondary}>
            Send the steps to someone
          </button>
        </div>
      )}
    </div>
  );
}
