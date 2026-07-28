// Rotisserie-style per-category team production, computed from raw NFL stat numerics summed
// across each team's starters. AFFL itself is a head-to-head points league — this re-scores the
// same underlying stats as if it were a 9-category roto league, purely as a supplemental view.
import type { Season, SeasonBox } from '../types';
import { tierInPhase, type Phase } from './phase';

export type CatKey = 'py' | 'ptd' | 'compPct' | 'ry' | 'rtd' | 'ypc' | 'recy' | 'retd' | 'rec' | 'ypr';
export type CatGroup = 'Passing' | 'Rushing' | 'Receiving';

export interface CategoryValue {
  key: CatKey;
  label: string;
  group: CatGroup;
  value: number;
  rank: number; // 1 = best in the league that season
  pts: number; // roto points: worst = 1, best = nTeams
  norm: number; // 0-1, min-max normalized across the league (for radar plotting)
}

export interface TeamCategoryStats {
  teamId: number;
  ownerId: string;
  teamName: string;
  categories: CategoryValue[];
  totalPts: number;
  totalRank: number;
  games: number; // eligible games summed — unequal counts make a roto comparison apples-to-oranges
}

const CATS: { key: CatKey; label: string; group: CatGroup }[] = [
  { key: 'py', label: 'Pass Yds', group: 'Passing' },
  { key: 'ptd', label: 'Pass TD', group: 'Passing' },
  { key: 'compPct', label: 'Comp%', group: 'Passing' },
  { key: 'ry', label: 'Rush Yds', group: 'Rushing' },
  { key: 'rtd', label: 'Rush TD', group: 'Rushing' },
  { key: 'ypc', label: 'YPC', group: 'Rushing' },
  { key: 'recy', label: 'Rec Yds', group: 'Receiving' },
  { key: 'retd', label: 'Rec TD', group: 'Receiving' },
  { key: 'rec', label: 'Rec', group: 'Receiving' },
  { key: 'ypr', label: 'YPR', group: 'Receiving' },
];

interface RawTotals {
  py: number; ptd: number; cmp: number; att: number;
  ry: number; rtd: number; car: number;
  rec: number; recy: number; retd: number;
  games: number;
}
const emptyTotals = (): RawTotals => ({ py: 0, ptd: 0, cmp: 0, att: 0, ry: 0, rtd: 0, car: 0, rec: 0, recy: 0, retd: 0, games: 0 });

// `phase` defaults to 'reg' because it is the only phase where every team plays the same number of
// games. Postseason schedules are uneven by construction (byes, 2- vs 3-game ladders), so ranking
// raw counting stats over anything that includes them rewards volume, not production.
export function computeCategoryStats(
  box: SeasonBox,
  season: Season,
  phase: Phase = 'reg',
  includeConsolation = false,
): TeamCategoryStats[] {
  const totals = new Map<number, RawTotals>();
  const T = (tid: number) => {
    let t = totals.get(tid);
    if (!t) totals.set(tid, (t = emptyTotals()));
    return t;
  };
  for (const games of Object.values(box.weeks)) {
    for (const g of games) {
      if (!tierInPhase(g.tier, phase, includeConsolation)) continue;
      for (const side of [g.home, g.away]) {
        const t = T(side.teamId);
        t.games += 1;
        for (const p of side.starters) {
          if (!p.st) continue;
          t.py += p.st.py; t.ptd += p.st.ptd; t.cmp += p.st.cmp; t.att += p.st.att;
          t.ry += p.st.ry; t.rtd += p.st.rtd; t.car += p.st.car;
          t.rec += p.st.rec; t.recy += p.st.recy; t.retd += p.st.retd;
        }
      }
    }
  }

  const teamMeta = new Map(season.teams.map((t) => [t.teamId, t]));
  const nTeams = totals.size;

  const derived = [...totals.entries()].map(([teamId, raw]) => ({
    teamId,
    games: raw.games,
    values: {
      py: raw.py,
      ptd: raw.ptd,
      compPct: raw.att > 0 ? (raw.cmp / raw.att) * 100 : 0,
      ry: raw.ry,
      rtd: raw.rtd,
      ypc: raw.car > 0 ? raw.ry / raw.car : 0,
      recy: raw.recy,
      retd: raw.retd,
      rec: raw.rec,
      ypr: raw.rec > 0 ? raw.recy / raw.rec : 0,
    } as Record<CatKey, number>,
  }));

  const rankAndNorm = new Map<number, Map<CatKey, { rank: number; pts: number; norm: number }>>();
  for (const cat of CATS) {
    const vals = derived.map((d) => d.values[cat.key]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const sorted = [...derived].sort((a, b) => b.values[cat.key] - a.values[cat.key]);
    sorted.forEach((d, i) => {
      const rank = i + 1;
      const pts = nTeams - rank + 1;
      const norm = (d.values[cat.key] - min) / span;
      if (!rankAndNorm.has(d.teamId)) rankAndNorm.set(d.teamId, new Map());
      rankAndNorm.get(d.teamId)!.set(cat.key, { rank, pts, norm });
    });
  }

  const out: TeamCategoryStats[] = derived.map((d) => {
    const t = teamMeta.get(d.teamId);
    const categories: CategoryValue[] = CATS.map((cat) => {
      const rn = rankAndNorm.get(d.teamId)!.get(cat.key)!;
      return { key: cat.key, label: cat.label, group: cat.group, value: d.values[cat.key], ...rn };
    });
    const totalPts = categories.reduce((a, c) => a + c.pts, 0);
    return { teamId: d.teamId, ownerId: t?.ownerId ?? '', teamName: t?.teamName ?? `Team ${d.teamId}`, categories, totalPts, totalRank: 0, games: d.games };
  });

  out.sort((a, b) => b.totalPts - a.totalPts);
  out.forEach((t, i) => (t.totalRank = i + 1));
  return out;
}

// League-average categories, normalized on the SAME min-max scale each team's `norm` uses —
// so it can be overlaid as a reference polygon on a team's radar chart.
export function leagueAverageNorm(teams: TeamCategoryStats[]): Record<CatKey, number> {
  const avg = {} as Record<CatKey, number>;
  if (!teams.length) return avg;
  for (const cat of CATS) {
    const vals = teams.map((t) => t.categories.find((c) => c.key === cat.key)!.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const mean = vals.reduce((a, v) => a + v, 0) / vals.length;
    avg[cat.key] = (mean - min) / span;
  }
  return avg;
}
