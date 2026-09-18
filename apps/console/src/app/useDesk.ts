/**
 * The Messages desk, from whichever books are open.
 *
 * Returns the whole read rather than the desk, because what this pass
 * cannot derive — what is worth posting, and every record whose window has
 * no rows in it yet — is as much a fact about the screen as the lenses that
 * did derive. The footnote under the lenses is where it goes.
 */

import { demoDesk, readDesk, type DeskRead } from '@ow/data';
import { useBook, type Loaded } from './useBook.js';

export type DeskState = Loaded<DeskRead>;

const example = (): DeskRead => ({ desk: demoDesk(), unreadable: [] });

export const useDesk = (): DeskState => useBook('messages', readDesk, example);
