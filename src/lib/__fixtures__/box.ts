// Synthetic boxscore fixtures shaped like the real AFFL data: an equal regular season, then a
// postseason where the winners bracket and the consolation ladder run different numbers of games.
import type { BoxGame, BoxSide, PlayoffTier, Season, SeasonBox, SeasonTeam } from '../../types';

/** Every stat scales with `f`, so all ten categories rank teams in the same order. */
export function statLine(f: number) {
  return { att: 100, cmp: f, py: f, ptd: f, car: 100, ry: f, rtd: f, rec: f, recy: f, retd: f };
}

function side(teamId: number, f: number): BoxSide {
  return {
    teamId,
    ownerId: `o${teamId}`,
    teamName: `Team ${teamId}`,
    abbrev: `T${teamId}`,
    total: f,
    benchTotal: 0,
    starters: [{ id: teamId, n: `P${teamId}`, p: 'WR', tm: 'FA', pt: f, l: '', st: statLine(f), s: 'WR' }],
    bench: [],
  };
}

export function game(tier: PlayoffTier, home: [number, number], away: [number, number]): BoxGame {
  return { mp: 0, tier, winner: 'HOME', home: side(home[0], home[1]), away: side(away[0], away[1]) };
}

export function seasonBox(year: number, weeks: Record<string, BoxGame[]>): SeasonBox {
  return { year, weeks };
}

/** Only `teams` is read by computeCategoryStats; the rest of Season is inert here. */
export function mkSeason(year: number, teamIds: number[]): Season {
  const teams = teamIds.map((teamId) => ({
    teamId,
    ownerId: `o${teamId}`,
    teamName: `Team ${teamId}`,
  })) as unknown as SeasonTeam[];
  return { year, teams } as unknown as Season;
}

// Per-game production. Regular season ordering is T1 > T2 > T3 > T4.
export const PACE = { 1: 100, 2: 90, 3: 85, 4: 70 } as const;

/**
 * Two equal regular-season weeks, then a postseason where T1/T2 play one winners-bracket game and
 * T3/T4 play two consolation games. Counting consolation hands T3 the most volume in the league
 * despite the third-best per-game production — which is exactly the bias being guarded against.
 */
export function fixtureBox(year = 2025): SeasonBox {
  const reg = () => [
    game('NONE', [1, PACE[1]], [2, PACE[2]]),
    game('NONE', [3, PACE[3]], [4, PACE[4]]),
  ];
  return seasonBox(year, {
    1: reg(),
    2: reg(),
    3: [
      game('WINNERS_BRACKET', [1, PACE[1]], [2, PACE[2]]),
      game('LOSERS_CONSOLATION_LADDER', [3, PACE[3]], [4, PACE[4]]),
    ],
    4: [game('LOSERS_CONSOLATION_LADDER', [3, PACE[3]], [4, PACE[4]])],
  });
}

export const fixtureSeason = (year = 2025) => mkSeason(year, [1, 2, 3, 4]);
