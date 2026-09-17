/**
 * A figure the shop could act on.
 *
 * This is the "money is a component, not a span" law, and it is one of the
 * very few things both designs share — because it is typography, not
 * layout. It renders the same glyphs on a desk and in a yard; only the size
 * around it differs, and that comes from the design it sits in.
 *
 * It also renders a `Derived<Money>` directly, which is the point: there is
 * no way to put a figure on screen here without the three cases having been
 * answered. An unavailable figure renders as the reason it is unavailable,
 * never as a dash and never as zero.
 */

import type { ReactElement } from 'react';
import { Money, match, type Derived } from '@ow/domain';

export interface FigureProps {
  /** The figure, with its provenance. */
  readonly value: Derived<Money.Money>;
  /** "UGX", "kg", "sheets". Sits after the figure, in the ink colour. */
  readonly unit?: string;
  /**
   * Show the basis line under the figure. On a desktop metric strip, yes —
   * it is the difference between a number and an interrogable number. In a
   * dense table cell, no; the column header carries it.
   */
  readonly showBasis?: boolean;
  /**
   * Colour the figure by meaning. Defaults to `none`, and that default is
   * the rule: **a figure is a size, not a warning.** Reach for `bad` only
   * when the figure is genuinely bad — overdue, a loss, behind target.
   */
  readonly tone?: 'none' | 'good' | 'warn' | 'bad';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly align?: 'left' | 'right';
}

const TONE_INK = {
  none: 'var(--ow-color-ink)',
  good: 'var(--ow-color-good)',
  warn: 'var(--ow-color-warn)',
  bad: 'var(--ow-color-bad)',
} as const;

const SIZE = {
  sm: { figure: 'var(--ow-size-13)', basis: 'var(--ow-size-11)' },
  md: { figure: 'var(--ow-size-16)', basis: 'var(--ow-size-11)' },
  lg: { figure: 'var(--ow-size-24)', basis: 'var(--ow-size-12)' },
} as const;

export function Figure({
  value,
  unit,
  showBasis = false,
  tone = 'none',
  size = 'md',
  align = 'left',
}: FigureProps): ReactElement {
  const s = SIZE[size];

  return match(value, {
    known: (amount, basis) => (
      <Shown
        text={Money.format(amount)}
        unit={unit}
        basis={showBasis ? basis : undefined}
        tone={tone}
        s={s}
        align={align}
      />
    ),

    // A partial figure is real and worth showing — but never bare. The
    // caveat rides with it, always, so the number can never be quoted
    // onward as if it were whole.
    partial: (amount, basis, missing) => (
      <Shown
        text={Money.format(amount)}
        unit={unit}
        basis={showBasis ? basis : undefined}
        caveat={missing}
        tone={tone}
        s={s}
        align={align}
      />
    ),

    // Not a dash, not "—", not 0. The reason. A screen that cannot derive a
    // number says so, and says why, so the owner can go and fix the cause.
    unavailable: (reason) => (
      <span
        title={reason}
        style={{
          display: 'block',
          textAlign: align,
          fontSize: s.basis,
          lineHeight: 'var(--ow-leading-snug)',
          color: 'var(--ow-color-ink-3)',
          fontStyle: 'italic',
          maxWidth: '22ch',
        }}
      >
        {reason}
      </span>
    ),
  });
}

interface ShownProps {
  readonly text: string;
  readonly unit: string | undefined;
  readonly basis: string | undefined;
  readonly caveat?: string | undefined;
  readonly tone: NonNullable<FigureProps['tone']>;
  readonly s: (typeof SIZE)[keyof typeof SIZE];
  readonly align: 'left' | 'right';
}

function Shown({ text, unit, basis, caveat, tone, s, align }: ShownProps): ReactElement {
  return (
    <span style={{ display: 'block', textAlign: align }}>
      <span
        style={{
          // The four declarations that make a column of money scannable.
          // Tabular is the load-bearing one: a column that does not line up
          // cannot be read at a glance, and a glance is how it is read.
          fontFamily: 'var(--ow-font-mono)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 'var(--ow-tracking-figure)',
          fontWeight: 'var(--ow-weight-medium)',
          fontSize: s.figure,
          lineHeight: 'var(--ow-leading-tight)',
          color: TONE_INK[tone],
          // Money never truncates. A clipped figure is not a shortened
          // figure, it is a WRONG figure — "1,240,00" is a tenth of
          // "1,240,000" and looks entirely plausible.
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
      {unit !== undefined && (
        <span
          style={{
            marginLeft: 'var(--ow-space-2)',
            fontSize: s.basis,
            color: 'var(--ow-color-ink-3)',
            whiteSpace: 'nowrap',
          }}
        >
          {unit}
        </span>
      )}
      {caveat !== undefined && (
        <span
          style={{
            display: 'block',
            marginTop: 'var(--ow-space-1)',
            fontSize: s.basis,
            lineHeight: 'var(--ow-leading-snug)',
            color: 'var(--ow-color-warn)',
          }}
        >
          {caveat}
        </span>
      )}
      {basis !== undefined && (
        <span
          style={{
            display: 'block',
            marginTop: 'var(--ow-space-1)',
            fontSize: s.basis,
            lineHeight: 'var(--ow-leading-snug)',
            color: 'var(--ow-color-ink-3)',
          }}
        >
          {basis}
        </span>
      )}
    </span>
  );
}
