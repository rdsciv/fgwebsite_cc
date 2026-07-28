// Per-manager scoring distributions, derived from the matchup table.
//
// `owner.allTime.scoreDistribution` is baked by the pipeline but only as a career
// five-number summary. The clubhouse wants the shape — a histogram and a per-season
// breakdown — so those are derived here from the same matchups the standings use,
// which keeps them reconcilable with PF by construction.
import type { League, ScoreDistribution } from '../types';

export interface SeasonScores {
  year: number;
  scores: number[];
  dist: ScoreDistribution;
}

/**
 * Every single-week score this manager posted, optionally limited to one season.
 *
 * Multi-week playoff matchups (30 of them league-wide) carry a two-week aggregate in
 * `score`. Mixing those into a weekly distribution invents 200+ point "weeks" that
 * nobody ever scored, so they are excluded rather than silently averaged in.
 */
export function ownerScores(league: League, ownerId: string, year?: number): number[] {
  const out: number[] = [];
  for (const season of league.seasons) {
    if (year != null && season.year !== year) continue;
    for (const m of season.matchups) {
      if (!m.singleWeek) continue;
      if (m.home.ownerId === ownerId) out.push(m.home.score);
      else if (m.away.ownerId === ownerId) out.push(m.away.score);
    }
  }
  return out;
}

/** Five-number summary. Returns null rather than a fake zero when there is nothing to summarize. */
export function distribution(scores: number[]): ScoreDistribution | null {
  const n = scores.length;
  if (!n) return null;
  const s = [...scores].sort((a, b) => a - b);
  const at = (q: number) => {
    const i = (n - 1) * q;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
  };
  return { min: s[0], q1: at(0.25), median: at(0.5), q3: at(0.75), max: s[n - 1], n };
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Population standard deviation — the league's week-to-week volatility measure. */
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}

export interface Bin {
  lo: number;
  hi: number;
  count: number;
  label: string;
}

/** Fixed-width bins over an explicit domain, so every manager's histogram is comparable. */
export function histogram(scores: number[], lo: number, hi: number, binSize: number): Bin[] {
  const start = Math.floor(lo / binSize) * binSize;
  const end = Math.ceil(hi / binSize) * binSize;
  const bins: Bin[] = [];
  for (let x = start; x < end; x += binSize) {
    bins.push({ lo: x, hi: x + binSize, count: 0, label: String(x) });
  }
  for (const v of scores) {
    let i = Math.floor((v - start) / binSize);
    if (i < 0) i = 0;
    if (i >= bins.length) i = bins.length - 1;
    if (bins[i]) bins[i].count += 1;
  }
  return bins;
}

/** One distribution per season played, ascending. */
export function seasonDistributions(league: League, ownerId: string): SeasonScores[] {
  const out: SeasonScores[] = [];
  for (const season of [...league.seasons].sort((a, b) => a.year - b.year)) {
    const scores = ownerScores(league, ownerId, season.year);
    const dist = distribution(scores);
    if (dist) out.push({ year: season.year, scores, dist });
  }
  return out;
}

/** Shared domain across a set of distributions, so box plots line up honestly. */
export function sharedDomain(dists: ScoreDistribution[], pad = 5): [number, number] {
  if (!dists.length) return [0, 1];
  return [
    Math.floor(Math.min(...dists.map((d) => d.min)) - pad),
    Math.ceil(Math.max(...dists.map((d) => d.max)) + pad),
  ];
}
