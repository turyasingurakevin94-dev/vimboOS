/**
 * The moves, at the edges that bite.
 *
 * Three of them are ported decisions rather than choices made here: what
 * `after` indexes into, which figures are gains, and that a move with no
 * figure says so instead of showing a nought.
 */

import { describe, expect, it } from 'vitest';
import * as Money from './money.js';
import { rankMoves, WORTH_BASES, type MoveRecord } from './manager.js';

const move = (over: Partial<MoveRecord> = {}): MoveRecord => ({
  id: 'm1',
  meetingId: 'meet-1',
  title: 'Ask Mulongo Hardware for a deposit',
  why: 'Five chases since 2 August produced nothing.',
  worth: Money.money(3_330_000),
  worthBasis: 'cash_freed',
  lever: 'collect',
  unlocks: null,
  door: 'chase',
  after: null,
  settled: false,
  ...over,
});

describe('ranking the moves', () => {
  it('numbers the open ones and says how many there are', () => {
    const ranked = rankMoves([
      move({ id: 'a' }),
      move({ id: 'b', settled: true }),
      move({ id: 'c' }),
    ]);

    expect(ranked.map((m) => [m.position, m.of])).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  // `after` is an index into the meeting's WHOLE plan in id order. Filtering
  // the settled ones out first would repoint every dependency at whatever
  // moved up into that slot.
  it('resolves what a move waits on against every move, not just the open ones', () => {
    const ranked = rankMoves([
      move({ id: 'a', title: 'Get the deposit' }),
      move({ id: 'b', title: 'Pay the supplier' }),
      move({ id: 'c', title: 'Order the sheets', after: 1 }),
    ]);

    expect(ranked.find((m) => m.id === 'c')?.waitsOn).toEqual({
      position: 2,
      title: 'Pay the supplier',
    });
  });

  it('stops saying a move waits on one that is already done', () => {
    const ranked = rankMoves([
      move({ id: 'a', title: 'Get the deposit', settled: true }),
      move({ id: 'b', title: 'Order the sheets', after: 0 }),
    ]);

    // Holding the owner off the one thing they could get on with.
    expect(ranked[0]?.waitsOn).toBeNull();
  });

  it('ignores an `after` that points nowhere, rather than inventing a blocker', () => {
    expect(rankMoves([move({ after: 9 })])[0]?.waitsOn).toBeNull();
    expect(rankMoves([move({ id: 'self', after: 0 })])[0]?.waitsOn).toBeNull();
  });

  // The old app's scar: this figure was drawn in bad-news crimson, switched
  // on by the figure merely existing, so a move worth 3,330,000 to GAIN
  // rendered in the same red as a debt going bad.
  it('marks money arriving as a gain, and money at stake as a size', () => {
    const gain = (basis: string): boolean =>
      rankMoves([move({ worthBasis: basis })])[0]?.isGain === true;

    expect(gain('profit_30d')).toBe(true);
    expect(gain('cost_saved')).toBe(true);
    expect(gain('cash_freed')).toBe(false);
    expect(gain('loss_avoided')).toBe(false);
  });

  it('says a move has no figure rather than showing a nought', () => {
    for (const worth of [null, Money.ZERO]) {
      const [ranked] = rankMoves([move({ worth })]);

      expect(ranked?.worth.status).toBe('unavailable');
      expect(ranked?.worthLabel).toBe('');
    }
  });

  it('labels the figure with what it means', () => {
    expect(rankMoves([move({ worthBasis: 'profit_30d' })])[0]?.worthLabel).toBe(
      WORTH_BASES.profit_30d,
    );
    // A basis the meeting invented becomes nothing rather than a label the
    // screen would print unchallenged — the old app's own rule.
    expect(rankMoves([move({ worthBasis: 'vibes' })])[0]?.worthLabel).toBe('on this move');
  });

  it('drops a door and a lever it does not recognise', () => {
    const [ranked] = rankMoves([move({ door: 'nowhere', lever: 'guess' })]);

    expect(ranked?.door).toBeNull();
    expect(ranked?.lever).toBeNull();
  });

  // 39 open moves across several meetings, and `after` counts within one
  // plan. Resolved against the whole pile, a dependency points at a move
  // from a different week.
  it('keeps a dependency inside its own meeting', () => {
    const ranked = rankMoves([
      move({ id: 'a', meetingId: 'monday', title: 'Monday first' }),
      move({ id: 'b', meetingId: 'monday', title: 'Monday second' }),
      move({ id: 'c', meetingId: 'friday', title: 'Friday first' }),
      move({ id: 'd', meetingId: 'friday', title: 'Friday second', after: 1 }),
    ]);

    // Index 1 of FRIDAY's plan is 'Friday second' itself, not 'Monday
    // second' — so this one waits on nothing, and must not be told it
    // waits on another week's work.
    expect(ranked.find((m) => m.id === 'd')?.waitsOn).toBeNull();

    const alsoFriday = rankMoves([
      move({ id: 'a', meetingId: 'monday', title: 'Monday first' }),
      move({ id: 'c', meetingId: 'friday', title: 'Friday first' }),
      move({ id: 'd', meetingId: 'friday', title: 'Friday second', after: 0 }),
    ]);

    expect(alsoFriday.find((m) => m.id === 'd')?.waitsOn).toEqual({
      position: 2,
      title: 'Friday first',
    });
  });

  it('resolves a door it does recognise to the screen that opens it', () => {
    expect(rankMoves([move({ door: 'invoices' })])[0]?.door).toEqual({
      id: 'invoices',
      screen: 'invoices',
      label: 'Open Invoices',
    });
  });

  // Whether a chase was actually PAID is the customer ledger's answer, and
  // that port is not done. A card must not imply it knows.
  it('admits the outcome derivation is not ported', () => {
    expect(rankMoves([move()])[0]?.outcomeUnported).toBe(true);
  });
});
