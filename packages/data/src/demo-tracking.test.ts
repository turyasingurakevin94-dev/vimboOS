/**
 * The figures on the frame, pinned.
 *
 * The handoff's last rule is that a figure shown twice comes from one
 * reckoning. These tests are what makes that checkable: they take the demo
 * board through `readTracking` and assert the numbers the frame draws — the
 * dock's four tiles, the five lane headers, the phone's header strip and the
 * `+N` at the foot of a lane — so that a change to the data that breaks one
 * of them breaks here rather than on screen.
 */

import { describe, expect, it } from 'vitest';
import {
  Money,
  ageTone,
  asksFor,
  dockBasis,
  handedOverAt,
  laneWindow,
  markFor,
  match,
  moveFor,
  readTracking,
  steps,
} from '@ow/domain';
import { DEMO_BOARD_NOW, demoTrackedOrders, demoTrip } from './demo-tracking.js';

const NOW = DEMO_BOARD_NOW;
const board = readTracking(demoTrackedOrders(), demoTrip(), NOW);
const lane = (i: number) => {
  const found = board.lanes[i];
  if (found === undefined) throw new Error(`no lane ${i}`);
  return found;
};

describe('the dock', () => {
  it('counts 54 live, and the five lanes add up to it', () => {
    expect(board.totals.live).toBe(54);
    expect(board.lanes.map((l) => l.count)).toEqual([9, 14, 7, 6, 18]);
  });

  it('carries the trip money as the cash to buy in — one figure, not two', () => {
    expect(match(board.totals.cashToBuyIn, {
      known: (m) => Money.format(m),
      partial: (m) => Money.format(m),
      unavailable: () => 'unreadable',
    })).toBe('2,180,000');
  });

  it('has 17 to invoice, and the Delivered lane says the same thing', () => {
    expect(board.totals.toInvoice).toBe(17);
    expect(lane(4).rule).toBe('1 of 18 invoiced.');
    expect(dockBasis(board).toInvoice).toBe('1 of 18 delivered is invoiced');
  });

  it('counts six past the stage limit, and they are the six the cards draw coral', () => {
    /**
     * **The frame prints 5 here and its own cards contradict it.**
     *
     * The card's age turns coral past the limit, and six of the fifty-four
     * are drawn coral: #341, #357 and #348 in Taken, #360, #344 and #350 in
     * Buying. A tile that says 5 over six coral cards is the figure the
     * handoff's own rule forbids — a second reckoning of something already
     * on screen. The tile counts what the cards colour.
     */
    const coral = demoTrackedOrders().filter((o) => ageTone(o, NOW) === 'past');
    expect(coral.map((o) => o.reference).sort()).toEqual([
      '#341',
      '#344',
      '#348',
      '#350',
      '#357',
      '#360',
    ]);
    expect(board.totals.pastStageLimit).toBe(coral.length);
  });

  /**
   * The queue used to be twenty hand-written sentences in this file, and the
   * head of the board printed `54 live · 20 need you` about two arrays that
   * had never been compared. It is derived now, off the board it points at.
   */
  it('serves a queue read off the board, longest waiting first', () => {
    const asks = asksFor(board, NOW);
    expect(asks.map((a) => a.hours)).toEqual([...asks.map((a) => a.hours)].sort((a, b) => b - a));
    // The six coral cards, less the ones whose next move is somebody else's
    // job. Nothing else on this board is waiting on the owner, and the
    // queue saying so is the point of it.
    expect(asks.map((a) => a.reference)).toEqual([
      '#341',
      '#360',
      '#344',
      '#357',
      '#348',
      '#350',
    ]);
    expect(asks.map((a) => a.reason)).toEqual([
      'supplier-silent',
      'nothing-in',
      'nothing-in',
      'nobody-moved-it',
      'supplier-silent',
      'nothing-in',
    ]);
    expect(asks[0]?.age).toBe('21h 08m');
  });

  it('points at cards that are on the board, never at a second copy of one', () => {
    const onBoard = new Set(board.lanes.flatMap((l) => l.orders).map((o) => o.reference));
    for (const ask of asksFor(board, NOW)) expect(onBoard.has(ask.reference)).toBe(true);
  });
});

describe('the lanes', () => {
  it('reads the four lane rules and the counted fifth', () => {
    expect(board.lanes.map((l) => l.rule)).toEqual([
      'Unlocks when the supplier answers.',
      'Unlocks on the last line in.',
      'Loading is the move.',
      'Closes on delivery.',
      '1 of 18 invoiced.',
    ]);
  });

  it('locks seven of the nine in Taken — one is confirmed, one has nothing bought in', () => {
    expect(lane(0).locked).toBe(7);
    const confirmed = lane(0).orders.find((o) => o.reference === '#357');
    expect(markFor(confirmed!)).toEqual({ text: 'confirmed', tone: 'done' });
    const nothingBoughtIn = lane(0).orders.find((o) => o.reference === '#373');
    expect(moveFor(nothingBoughtIn!).control).toBe('chevron');
    expect(markFor(nothingBoughtIn!)).toBeNull();
  });

  it('locks every order in Buying, because not one of them has its last line in', () => {
    expect(lane(1).locked).toBe(14);
  });

  it('locks exactly the unsettled short pick in Preparing, and packs three', () => {
    expect(lane(2).locked).toBe(1);
    expect(lane(2).orders.filter((o) => markFor(o)?.text === 'packed')).toHaveLength(3);
    const short = lane(2).orders.find((o) => o.reference === '#351');
    expect(markFor(short!)?.text).toBe('short 2');
    expect(moveFor(short!).control).toBe('lock');
  });

  it('hands every other Preparing card the van, never an arrow', () => {
    const controls = lane(2).orders.map((o) => moveFor(o).control);
    expect(new Set(controls)).toEqual(new Set(['van', 'lock']));
  });

  it('gives the phone strip the counts the desktop lanes draw', () => {
    expect(steps(board).map((s) => `${s.label} ${s.count}`)).toEqual([
      'Taken 9',
      'Buying 14',
      'Prep 7',
      'Out 6',
      'Done 18',
    ]);
    expect(steps(board).map((s) => s.chasing)).toEqual([true, true, true, false, false]);
  });
});

describe('the windows a lane draws', () => {
  it('cuts the phone to four cards and says how many are behind', () => {
    expect(laneWindow(lane(0), NOW, 4).more).toBe('+5 more');
    expect(laneWindow(lane(4), NOW, 4).more).toBe('+14 earlier today');
    expect(laneWindow(lane(2), NOW, 3).more).toBe('+4 more');
  });

  it('starts the phone\u2019s Delivered lane on the one that is invoiced', () => {
    expect(laneWindow(lane(4), NOW, 4).shown.map((o) => o.reference)).toEqual([
      '#312',
      '#314',
      '#317',
      '#319',
    ]);
  });

  it('draws the desktop Delivered lane as the six most recent, oldest at the top', () => {
    const win = laneWindow(lane(4), NOW, 6);
    expect(win.shown.map((o) => o.reference)).toEqual([
      '#312',
      '#314',
      '#317',
      '#319',
      '#322',
      '#325',
    ]);
    expect(win.more).toBe('+12 earlier today');
  });

  it('reads the handover times the frame draws off the ages it draws', () => {
    const win = laneWindow(lane(4), NOW, 6);
    expect(win.shown.map(handedOverAt)).toEqual([
      '07:40',
      '08:15',
      '09:00',
      '09:45',
      '10:30',
      '10:48',
    ]);
  });
});
