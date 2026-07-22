// RB auction spend vs. RB starter production, one point per team for a given season.
import type { Season, SeasonBox } from '../types';

export interface RbBuildPoint {
  teamId: number;
  ownerId: string;
  teamName: string;
  abbrev: string;
  rbDollars: number;
  rbPoints: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeRbBuild(season: Season, box: SeasonBox): RbBuildPoint[] {
  const dollarsByTeam = new Map<number, number>();
  for (const p of season.draft.picks) {
    if (p.pos !== 'RB') continue;
    dollarsByTeam.set(p.teamId, (dollarsByTeam.get(p.teamId) ?? 0) + p.bid);
  }
  const pointsByTeam = new Map<number, number>();
  for (const games of Object.values(box.weeks)) {
    for (const g of games) {
      for (const side of [g.home, g.away]) {
        for (const player of side.starters) {
          if (player.p !== 'RB') continue;
          pointsByTeam.set(side.teamId, (pointsByTeam.get(side.teamId) ?? 0) + player.pt);
        }
      }
    }
  }
  return season.teams.map((t) => ({
    teamId: t.teamId,
    ownerId: t.ownerId,
    teamName: t.teamName,
    abbrev: t.abbrev,
    rbDollars: round2(dollarsByTeam.get(t.teamId) ?? 0),
    rbPoints: round2(pointsByTeam.get(t.teamId) ?? 0),
  }));
}
