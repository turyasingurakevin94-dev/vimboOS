/**
 * Setup › The shop › WhatsApp — frame 3a.
 *
 * The connection that was never made, as ONE card in the place things are
 * configured once. See the head of `Shop.module.css` for the argument; what
 * the code has to get right is the order of the two halves.
 *
 * The promise comes FIRST — *linking changes nothing on your phone* — because
 * the real reason a shop does not link is the fear that it breaks the number
 * the business runs on, and that sentence is the only thing on the screen that
 * answers it. Read before the decision, not after it.
 */

import { useEffect, useState, type ReactElement } from 'react';
import { CATALOGUE_WITH_PHOTO_AND_PRICE, PICKED_LIST_SIZE, demoLink } from '@ow/data';
import s from './Shop.module.css';
import { LinkWhatsApp } from './LinkWhatsApp.js';
import { Icon, type IconName } from '../icons.js';

/**
 * What linking would turn on, in the future tense, each naming a figure the
 * shop already has. "Nothing to show" three times said one thing; these say
 * three.
 */
const TURNS_ON: readonly {
  readonly icon: IconName;
  readonly title: string;
  readonly say: ReactElement;
}[] = [
  {
    icon: 'message-square',
    title: 'Read and answer chats here',
    say: <>With the customer&#8217;s account, debt and last order beside the conversation</>,
  },
  {
    icon: 'shopping-bag',
    title: 'Let customers browse what you sell',
    say: (
      <>
        Your catalogue, with the{' '}
        <span className={s.turnFig}>{CATALOGUE_WITH_PHOTO_AND_PRICE}</span> products that have
        a photo and a price
      </>
    ),
  },
  {
    icon: 'send',
    title: 'Send one message to a picked list',
    say: (
      <>
        A price change to the <span className={s.turnFig}>{PICKED_LIST_SIZE}</span> people who
        buy that line, in one send
      </>
    ),
  },
];

export interface ShopProps {
  /** The card, as the third crumb: frame 3a reads "Setup › The shop › WhatsApp". */
  readonly onTrail?: (trail: string | null) => void;
}

export function Shop({ onTrail }: ShopProps): ReactElement {
  const link = demoLink();
  const [linked, setLinked] = useState(link.linked);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onTrail?.('WhatsApp');
    return () => onTrail?.(null);
  }, [onTrail]);

  return (
    <div className={s.page}>
      <section className={s.card} aria-label="WhatsApp">
        <div className={s.head}>
          <span className={s.mark}>
            <Icon name="message-square" size={18} />
          </span>
          <div className={s.headBody}>
            <div className={s.headTop}>
              <span className={s.title}>WhatsApp</span>
              <span className={linked ? s.linkedChip : s.chip}>
                {linked ? 'linked' : 'not linked'}
              </span>
            </div>
            <p className={s.promise}>
              <strong>Linking changes nothing on your phone.</strong> The same number keeps
              working there, chats keep arriving as they do now, and Omni&#8209;Ware starts
              seeing them too.
            </p>
          </div>
        </div>

        <div className={s.body}>
          <div className={s.label}>
            {linked ? 'What linking turned on' : 'What linking would turn on'}
          </div>
          <div className={s.turnsOn}>
            {TURNS_ON.map((t) => (
              <div key={t.title} className={s.turn}>
                <span className={s.turnMark}>
                  <Icon name={t.icon} size={15} />
                </span>
                <div className={s.turnBody}>
                  <div className={s.turnTitle}>{t.title}</div>
                  <div className={s.turnSay}>{t.say}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!linked && (
          <div className={s.foot}>
            {/* The action names the outcome, and the cost is beside it rather
                than discovered halfway through. */}
            <button type="button" className={s.primary} onClick={() => setOpen(true)}>
              Link the number
            </button>
            <span className={s.cost}>
              About ten minutes · you will need the phone in your hand
            </span>
            <span className={s.spacer} />
            <button type="button" className={s.secondary}>
              <Icon name="message-dots" size={15} />
              Send the steps to someone
            </button>
          </div>
        )}
      </section>

      <div className={s.locked}>
        <Icon name="lock" size={15} className={s.lockIcon} />
        <p className={s.lockedSay}>
          Nothing leaves the shop until you press send, and linking does not change that. Every
          figure on the Messages desk is counted from the shop&#8217;s own records either way.
        </p>
      </div>

      {open && (
        <LinkWhatsApp
          code={link.code}
          onClose={() => setOpen(false)}
          onLinked={() => {
            setLinked(true);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
