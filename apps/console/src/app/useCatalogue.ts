/**
 * What the shop sells, from whichever books are open.
 *
 * Read once for the whole screen rather than per keystroke: the catalogue
 * is 485 things on this shop and the search is a filter over an array, not
 * a query. A picker that asked the database on every letter would be slower
 * and would spell the answer differently on a bad connection.
 */

import { demoCatalogue, readCatalogue, type Catalogue } from '@ow/data';
import { useBook, type Loaded } from './useBook.js';

export type CatalogueState = Loaded<Catalogue>;

export const useCatalogue = (): CatalogueState =>
  useBook('catalogue', readCatalogue, demoCatalogue);
