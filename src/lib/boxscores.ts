import type { SeasonBox } from '../types';

// Player-level boxscores exist only from 2018 (ESPN's history cutoff).
export const FIRST_BOX_YEAR = 2018;
export const hasBoxscores = (year: number) => year >= FIRST_BOX_YEAR;

const cache = new Map<number, Promise<SeasonBox | null>>();

export function loadBoxscore(year: number): Promise<SeasonBox | null> {
  if (!hasBoxscores(year)) return Promise.resolve(null);
  if (!cache.has(year)) {
    cache.set(
      year,
      fetch(`./data/boxscores/${year}.json`)
        .then((r) => (r.ok ? (r.json() as Promise<SeasonBox>) : null))
        .catch(() => null),
    );
  }
  return cache.get(year)!;
}
