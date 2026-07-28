import type { SeasonBox } from '../types';

// Player-level boxscores exist only from 2018 (ESPN's history cutoff).
export const FIRST_BOX_YEAR = 2018;
export const hasBoxscores = (year: number) => year >= FIRST_BOX_YEAR;

const cache = new Map<number, Promise<SeasonBox | null>>();

export function loadBoxscore(year: number): Promise<SeasonBox | null> {
  if (!hasBoxscores(year)) return Promise.resolve(null);
  if (!cache.has(year)) {
    const p = fetch(`./data/boxscores/${year}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SeasonBox>) : null))
      .catch(() => null)
      // Never cache a failure. A single transient error would otherwise poison every later read
      // for the rest of the session, silently degrading anything that aggregates across seasons.
      .then((v) => {
        if (v === null) cache.delete(year);
        return v;
      });
    cache.set(year, p);
  }
  return cache.get(year)!;
}
