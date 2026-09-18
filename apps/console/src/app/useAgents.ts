/**
 * Sales agents, from whichever books are open.
 *
 * Returns the whole read, because what the books do not record is the most
 * important thing this screen has to say about the shop's own rows: there
 * is no cluster, no bonus and no payout anywhere in them, and the frames
 * draw all three. `notRecorded` is the screen's own footnote.
 */

import { demoAgents, demoSales, readAgents, type AgentBooks } from '@ow/data';
import { useBook, type Loaded } from './useBook.js';

export type AgentsState = Loaded<AgentBooks>;

const example = (): AgentBooks => ({
  agents: demoAgents(),
  sales: demoSales(),
  notRecorded: [],
  unreadable: [],
});

export const useAgents = (): AgentsState => useBook('agents', readAgents, example);
