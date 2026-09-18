/**
 * Linking the shop number — frame 5c.
 *
 * Opened from two places, so it lives in one: the line at the foot of the
 * Messages register, and the setup card in Setup › The shop. The square lasts
 * sixty seconds and a new one is free, which is why nothing here warns about
 * running out of time.
 *
 * The square is the control on a desk. On a phone it cannot be — you cannot
 * scan your own screen — so the phone has its own screen where the code leads.
 */

import { type ReactElement } from 'react';
import { LINK_CODE_SECONDS } from '@ow/domain';
import s from './LinkWhatsApp.module.css';
import { Icon } from '../icons.js';

export interface LinkWhatsAppProps {
  readonly code: string;
  readonly onClose: () => void;
  /** The square was pointed at, and the session came back. */
  readonly onLinked: () => void;
}

export function LinkWhatsApp({ code, onClose, onLinked }: LinkWhatsAppProps): ReactElement {
  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label="Link the shop number">
      <div className={s.dialog}>
        <div className={s.head}>
          <span className={s.title}>Link the shop number</span>
          <span className={s.spacer} />
          <button type="button" className={s.close} onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} strokeWidth={2.2} />
          </button>
        </div>

        <div className={s.body}>
          <div className={s.steps}>
            <div className={s.step}>
              <span className={s.stepNo}>1</span>
              <span className={s.stepSay}>Open WhatsApp on the shop phone</span>
            </div>
            <div className={s.step}>
              <span className={s.stepNo}>2</span>
              <span className={s.stepSay}>
                Tap <strong>Settings</strong>, then <strong>Linked devices</strong>
              </span>
            </div>
            <div className={s.step}>
              <span className={s.stepNo}>3</span>
              <span className={s.stepSay}>Point it at this square</span>
            </div>

            <div className={s.fallback}>
              <div className={s.label}>Camera not working?</div>
              <div className={s.fallbackSay}>
                Choose <em>link with a code</em> and type
              </div>
              {/* A non-breaking hyphen: a code that wrapped would be typed wrong. */}
              <div className={s.code}>{code.replace('-', '‑')}</div>
            </div>
          </div>

          <div className={s.square}>
            <button type="button" className={s.squareBox} onClick={onLinked} aria-label="Link">
              <Icon name="qr" size={120} strokeWidth={1.4} />
            </button>
            <div className={s.squareSay}>the square lasts {LINK_CODE_SECONDS} seconds</div>
          </div>
        </div>

        <div className={s.foot}>
          <span className={s.footSay}>
            Linking lets the shop read and answer chats here. Nothing sends itself, on either
            side.
          </span>
          <button type="button" className={s.secondary} onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
