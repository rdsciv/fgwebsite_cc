// Price-implied starter/bench split: within one manager's auction-year haul, the top bid(s)
// at each position (by the season's starting-slot counts) are treated as "starters," everyone
// else as bench — mirroring computeTeamPotential's exclusive-slots-then-FLEX allocation, but
// over draft-day $ instead of in-season points (no boxscore data needed).
import type { Owner, Season } from '../types';

export interface RosterConstructionPlayer {
  playerId: number;
  playerName: string;
  pos: string;
  bid: number;
  isStarter: boolean;
}
export interface RosterConstructionYear {
  year: number;
  totalSpend: number;
  starterCount: number;
  players: RosterConstructionPlayer[]; // starters (desc bid) first, then bench (desc bid)
}

const FLEX_POS = new Set(['RB', 'WR', 'TE']);

export function computeRosterConstruction(owner: Owner, seasons: Season[]): RosterConstructionYear[] {
  const out: RosterConstructionYear[] = [];
  for (const year of owner.seasonsPlayed) {
    const season = seasons.find((s) => s.year === year);
    if (!season || season.draftType !== 'auction') continue;
    const picks = season.draft.picks.filter((p) => p.ownerId === owner.id);
    if (!picks.length) continue;

    const byPos = new Map<string, typeof picks>();
    for (const p of picks) {
      if (!byPos.has(p.pos)) byPos.set(p.pos, []);
      byPos.get(p.pos)!.push(p);
    }
    for (const arr of byPos.values()) arr.sort((a, b) => b.bid - a.bid);

    const starterIds = new Set<number>();
    for (const [pos, count] of Object.entries(season.startingSlots)) {
      if (pos === 'FLEX' || !count) continue;
      const arr = byPos.get(pos) || [];
      for (let i = 0; i < count && i < arr.length; i++) starterIds.add(arr[i].playerId);
    }
    const flexCount = season.startingSlots.FLEX || 0;
    if (flexCount > 0) {
      const remaining = picks
        .filter((p) => FLEX_POS.has(p.pos) && !starterIds.has(p.playerId))
        .sort((a, b) => b.bid - a.bid);
      for (let i = 0; i < flexCount && i < remaining.length; i++) starterIds.add(remaining[i].playerId);
    }

    const starters = picks.filter((p) => starterIds.has(p.playerId)).sort((a, b) => b.bid - a.bid);
    const bench = picks.filter((p) => !starterIds.has(p.playerId)).sort((a, b) => b.bid - a.bid);
    const ordered = [...starters, ...bench];

    out.push({
      year,
      totalSpend: ordered.reduce((a, p) => a + p.bid, 0),
      starterCount: starters.length,
      players: ordered.map((p) => ({
        playerId: p.playerId,
        playerName: p.playerName,
        pos: p.pos,
        bid: p.bid,
        isStarter: starterIds.has(p.playerId),
      })),
    });
  }
  return out.sort((a, b) => a.year - b.year);
}
