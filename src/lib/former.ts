// A franchise is "former" once it stops appearing in the league's most recent season.
//
// Single source of truth: this rule was previously re-derived inline on every page that needed it,
// which is how two views drift into disagreeing about who is still in the league.
import type { Owner } from '../types';

export function isFormerOwner(o: Owner, lastSeason: number): boolean {
  const last = o.seasonsPlayed[o.seasonsPlayed.length - 1];
  return last == null || last < lastSeason;
}

/** Seasons a former franchise was active, e.g. "2016–2023". */
export function tenure(o: Owner): string {
  const first = o.seasonsPlayed[0];
  const last = o.seasonsPlayed[o.seasonsPlayed.length - 1];
  if (first == null) return '';
  return first === last ? `${first}` : `${first}–${last}`;
}
