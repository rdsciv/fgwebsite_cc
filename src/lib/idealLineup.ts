// Optimal-lineup solver: for a team's weekly player pool (starters + bench), finds the
// highest-scoring valid lineup under the season's starting-slot rules. AFFL's slot shell has
// exactly one multi-position slot (FLEX, eligible for RB/WR/TE), so filling every exclusive
// slot with its top scorer first and then FLEX with the best remaining eligible player is
// optimal — no other slot competes for the same players.
import type { BoxPlayer, Season, SeasonBox } from '../types';

export interface TeamPotential {
  teamId: number;
  ownerId: string;
  teamName: string;
  actualPts: number;
  idealPts: number;
  leftOnTable: number;
  pctOfIdeal: number;
}

const FLEX_POS = new Set(['RB', 'WR', 'TE']);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function idealLineupPts(pool: BoxPlayer[], slots: Record<string, number>): number {
  const byPos = new Map<string, BoxPlayer[]>();
  for (const p of pool) {
    if (!byPos.has(p.p)) byPos.set(p.p, []);
    byPos.get(p.p)!.push(p);
  }
  for (const arr of byPos.values()) arr.sort((a, b) => b.pt - a.pt);

  let total = 0;
  const used = new Set<BoxPlayer>();
  for (const [label, count] of Object.entries(slots)) {
    if (label === 'FLEX' || !count) continue;
    const arr = byPos.get(label) || [];
    for (let i = 0; i < count && i < arr.length; i++) {
      total += arr[i].pt;
      used.add(arr[i]);
    }
  }
  const flexCount = slots.FLEX || 0;
  if (flexCount > 0) {
    const remaining = pool.filter((p) => FLEX_POS.has(p.p) && !used.has(p)).sort((a, b) => b.pt - a.pt);
    for (let i = 0; i < flexCount && i < remaining.length; i++) total += remaining[i].pt;
  }
  return total;
}

export function computeTeamPotential(box: SeasonBox, season: Season): TeamPotential[] {
  const slots = season.startingSlots;
  const teamMeta = new Map(season.teams.map((t) => [t.teamId, t]));
  const agg = new Map<number, { actualPts: number; idealPts: number }>();
  const A = (tid: number) => {
    let a = agg.get(tid);
    if (!a) agg.set(tid, (a = { actualPts: 0, idealPts: 0 }));
    return a;
  };
  for (const games of Object.values(box.weeks)) {
    for (const g of games) {
      for (const side of [g.home, g.away]) {
        const a = A(side.teamId);
        a.actualPts += side.total;
        a.idealPts += idealLineupPts([...side.starters, ...side.bench], slots);
      }
    }
  }
  const out: TeamPotential[] = [];
  for (const [tid, a] of agg) {
    const t = teamMeta.get(tid);
    out.push({
      teamId: tid,
      ownerId: t?.ownerId ?? '',
      teamName: t?.teamName ?? `Team ${tid}`,
      actualPts: round2(a.actualPts),
      idealPts: round2(a.idealPts),
      leftOnTable: round2(a.idealPts - a.actualPts),
      pctOfIdeal: a.idealPts > 0 ? round2((a.actualPts / a.idealPts) * 100) : 0,
    });
  }
  out.sort((a, b) => b.idealPts - a.idealPts);
  return out;
}
