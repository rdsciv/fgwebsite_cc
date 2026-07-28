// Career roto rollup: every scored season re-ranked, then averaged per manager.
//
// Extracted from the page so the coverage rules are testable. The rule that matters: a season whose
// boxscore failed to load is NOT the same as a season a manager sat out. Silently folding the first
// into the second changes every average and ranking while looking like ordinary attendance, so a
// failed load is tracked per-year and surfaced as Partial/Unavailable (ENGINEERING_SPEC §6).
import type { Season, SeasonBox } from '../types';
import { computeCategoryStats } from './categoryStats';
import type { Phase } from './phase';

export type Evidence = 'Verified' | 'Partial' | 'Unavailable';

/** One expected season and what actually loaded. `box: null` means the fetch or parse failed. */
export interface SeasonLoad {
  year: number;
  season: Season | undefined;
  box: SeasonBox | null;
}

export interface RotoCareerRow {
  ownerId: string;
  seasons: number;
  avgRank: number;
  bestRank: number;
  worstRank: number;
  avgPts: number;
  // nTeams is per-year because a phase filter can change the size of the field a rank was earned in
  // (a postseason bracket is not 12 teams), and rank shading has to scale to the real field.
  byYear: Map<number, { rank: number; pts: number; nTeams: number }>;
}

export interface RotoCareerResult {
  rows: RotoCareerRow[];
  scoredYears: number[];
  missingYears: number[];
  evidence: Evidence;
}

export function buildRotoCareer(
  loads: SeasonLoad[],
  phase: Phase = 'reg',
  includeConsolation = false,
): RotoCareerResult {
  const scoredYears: number[] = [];
  const missingYears: number[] = [];
  const acc = new Map<string, RotoCareerRow>();

  for (const { year, season, box } of loads) {
    // No season metadata or no boxscore => we cannot score this year. Either way it is a coverage
    // gap in a year we expected to have, not evidence that anyone skipped it.
    if (!season || !box) {
      missingYears.push(year);
      continue;
    }
    const teams = computeCategoryStats(box, season, phase, includeConsolation);
    if (!teams.length) {
      missingYears.push(year);
      continue;
    }
    scoredYears.push(year);
    for (const t of teams) {
      if (!t.ownerId) continue;
      const c = acc.get(t.ownerId) ?? {
        ownerId: t.ownerId, seasons: 0, avgRank: 0, bestRank: Infinity, worstRank: 0, avgPts: 0, byYear: new Map(),
      };
      c.seasons += 1;
      c.avgRank += t.totalRank;
      c.avgPts += t.totalPts;
      c.bestRank = Math.min(c.bestRank, t.totalRank);
      c.worstRank = Math.max(c.worstRank, t.totalRank);
      c.byYear.set(year, { rank: t.totalRank, pts: t.totalPts, nTeams: teams.length });
      acc.set(t.ownerId, c);
    }
  }

  if (!scoredYears.length) {
    return { rows: [], scoredYears, missingYears, evidence: 'Unavailable' };
  }

  const rows = [...acc.values()]
    .map((c) => ({ ...c, avgRank: c.avgRank / c.seasons, avgPts: c.avgPts / c.seasons }))
    .sort((a, b) => a.avgRank - b.avgRank);

  return {
    rows,
    scoredYears,
    missingYears,
    evidence: missingYears.length ? 'Partial' : 'Verified',
  };
}
