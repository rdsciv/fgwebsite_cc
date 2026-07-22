import type { SeasonRosterAge } from '../types';

// Roster-age data exists only where boxscores do (player-level, 2018+).
export const FIRST_ROSTER_AGE_YEAR = 2018;
export const hasRosterAge = (year: number) => year >= FIRST_ROSTER_AGE_YEAR;

const cache = new Map<number, Promise<SeasonRosterAge | null>>();

export function loadRosterAge(year: number): Promise<SeasonRosterAge | null> {
  if (!hasRosterAge(year)) return Promise.resolve(null);
  if (!cache.has(year)) {
    cache.set(
      year,
      fetch(`./data/roster-age/${year}.json`)
        .then((r) => (r.ok ? (r.json() as Promise<SeasonRosterAge>) : null))
        .catch(() => null),
    );
  }
  return cache.get(year)!;
}
