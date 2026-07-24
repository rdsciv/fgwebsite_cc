// Types mirroring the computed public/data/league.json (see scripts/build-data.mjs).

export interface Meta {
  leagueName: string;
  leagueId: number;
  seasons: number[];
  firstSeason: number;
  lastSeason: number;
  nSeasons: number;
  nOwners: number;
  generatedAt: string;
}

export interface PowerRecord {
  wins: number;
  losses: number;
  ties: number;
  pct: number;
}

export interface ScoreDistribution {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  n: number;
}

export interface AllTime {
  wins: number;
  losses: number;
  ties: number;
  gamesPlayed: number;
  pct: number;
  pf: number;
  pa: number;
  ppg: number;
  papg: number;
  diff: number;
  regWins: number;
  regLosses: number;
  regTies: number;
  playoffWins: number;
  championships: number;
  runnerUps: number;
  lasts: number;
  playoffApps: number;
  regSeasonChamps: number;
  avgFinish: number | null;
  bestFinish: number | null;
  worstFinish: number | null;
  titles: number[];
  power: PowerRecord;
  scoreDistribution: ScoreDistribution;
}

export interface OwnerSeason {
  year: number;
  teamName: string;
  abbrev: string;
  division: string | null;
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
  ppg: number;
  weeks: number;
  regWins: number;
  regLosses: number;
  regTies: number;
  regRank: number | null;
  regSeasonChamp: boolean;
  finalRank: number | null;
  playoffSeed: number | null;
  madePlayoffs: boolean;
  playoffWins: number;
  champion: boolean;
  runnerUp: boolean;
  last: boolean;
  highWeek: number;
  lowWeek: number;
  powerWins: number;
  powerLosses: number;
  powerTies: number;
}

export interface Owner {
  id: string;
  name: string;
  displayName: string;
  aliases: string[];
  teamNames: string[];
  seasonsPlayed: number[];
  nSeasons: number;
  seasons: OwnerSeason[];
  allTime: AllTime;
}

export interface Podium {
  ownerId: string;
  teamName: string;
  abbrev: string;
  wins: number;
  losses: number;
  ties: number;
}

export interface SeasonTeam {
  teamId: number;
  ownerId: string;
  teamName: string;
  abbrev: string;
  logo: string;
  division: string | null;
  finalRank: number | null;
  playoffSeed: number | null;
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
  ppg: number;
  weeks: number;
  regWins: number;
  regLosses: number;
  regTies: number;
  regRank: number | null;
  madePlayoffs: boolean;
  playoffWins: number;
  playoffLosses: number;
  highWeek: number;
  lowWeek: number;
  powerWins: number;
  powerLosses: number;
  powerTies: number;
  powerPct: number;
  // regular-season luck suite (score-based, all seasons)
  regPowerPct: number; // all-play win% over the regular season
  expectedWins: number; // regPowerPct × regular-season games
  luckIndex: number; // regular-season win% − regPowerPct
  luckyWins: number; // wins while scoring in the bottom half that week
  unluckyLosses: number; // losses while scoring in the top half that week
  netLuck: number; // luckyWins − unluckyLosses
}

export type MatchupWinner = 'HOME' | 'AWAY' | 'TIE' | 'UNDECIDED';
export type PlayoffTier =
  | 'NONE'
  | 'WINNERS_BRACKET'
  | 'WINNERS_CONSOLATION_LADDER'
  | 'LOSERS_CONSOLATION_LADDER';

export interface MatchupSide {
  ownerId: string;
  teamId: number;
  score: number;
}

export interface Matchup {
  year: number;
  mp: number;
  tier: PlayoffTier;
  isReg: boolean;
  isPlayoff: boolean;
  isConsolation: boolean;
  singleWeek: boolean;
  winner: MatchupWinner;
  home: MatchupSide;
  away: MatchupSide;
}

export interface DraftPick {
  overall: number;
  round: number;
  roundPick: number;
  ownerId: string | null;
  teamId: number;
  playerId: number;
  playerName: string;
  pos: string;
  bid: number;
  keeper: boolean;
}

export interface Season {
  year: number;
  nTeams: number;
  regWeeks: number;
  draftType: 'auction' | 'snake';
  startingSlots: Record<string, number>; // e.g. { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, 'D/ST': 1, K: 1 }
  avgScore: number;
  divisions: string[];
  champion: Podium | null;
  runnerUp: Podium | null;
  third: Podium | null;
  sacko: Podium | null;
  regSeasonChamp: Podium | null;
  highestScorer: (Podium & { pf: number }) | null;
  teams: SeasonTeam[];
  matchups: Matchup[];
  draft: { type: 'auction' | 'snake'; picks: DraftPick[] };
}

export interface H2HCell {
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
}
export type HeadToHead = Record<string, Record<string, H2HCell>>;

export interface TeamWeek {
  year: number;
  week: number;
  ownerId: string;
  teamId: number;
  score: number;
  owner: string;
}
export interface BlowoutRow {
  year: number;
  week: number;
  tier: PlayoffTier;
  margin: number;
  winner: string;
  winScore: number;
  loser: string;
  loseScore: number;
}
export interface ShootoutRow {
  year: number;
  week: number;
  tier: PlayoffTier;
  combined: number;
  home: string;
  homeScore: number;
  away: string;
  awayScore: number;
}
export interface MarginRow {
  year: number;
  week: number;
  tier: PlayoffTier;
  owner: string;
  score: number;
  oppScore: number;
  opp: string;
}
export interface SeasonScoreRow {
  year: number;
  owner: string;
  teamName: string;
  pf: number;
  pa: number;
  wins: number;
  losses: number;
  ppg: number;
}
export interface StreakRow {
  owner: string;
  ownerId: string;
  maxW: number;
  maxWspan: string | null;
  maxL: number;
  maxLspan: string | null;
}
export interface BidRow {
  year: number;
  owner: string;
  player: string;
  pos: string;
  bid: number;
}

export interface Records {
  topWeeks: TeamWeek[];
  lowWeeks: TeamWeek[];
  blowouts: BlowoutRow[];
  nailbiters: BlowoutRow[];
  shootouts: ShootoutRow[];
  mostInLoss: MarginRow[];
  fewestInWin: MarginRow[];
  bestSeasonPF: SeasonScoreRow[];
  worstSeasonPF: SeasonScoreRow[];
  longestWin: StreakRow[];
  longestLose: StreakRow[];
  biggestBids: BidRow[];
  singleHigh: TeamWeek;
  singleLow: TeamWeek;
  biggestBlowout: BlowoutRow;
  closestGame: BlowoutRow;
  highestShootout: ShootoutRow;
}

export interface ChampRow {
  year: number;
  champion: { ownerId: string; owner: string; teamName: string; abbrev: string } | null;
  runnerUp: { owner: string; teamName: string } | null;
  sacko: { owner: string; teamName: string } | null;
  regChamp: { owner: string; teamName: string } | null;
}

// Raw per-category NFL stat numerics behind the formatted `l` string — category-stat features
// (Skill Radar / Roto Standings) sum these across starters rather than parsing `l`.
export interface BoxPlayerStats {
  att: number; // pass attempts
  cmp: number; // pass completions
  py: number; // pass yards
  ptd: number; // pass TD
  car: number; // rush attempts (carries)
  ry: number; // rush yards
  rtd: number; // rush TD
  rec: number; // receptions
  recy: number; // receiving yards
  retd: number; // receiving TD
}

// ---- weekly boxscores (public/data/boxscores/{year}.json), 2018+ ----
export interface BoxPlayer {
  id: number; // ESPN player id — join key to draft picks & external NFL data
  n: string; // player name
  p: string; // position (QB/RB/WR/TE/K/D/ST)
  tm: string; // NFL team abbrev
  pt: number; // fantasy points that week
  l: string; // NFL stat line (e.g. "212 pass yd · 2 pass TD")
  st: BoxPlayerStats | null; // raw per-category numerics (all-zero for K/D-ST; null only if the player didn't play that week)
  s: string; // lineup slot label (QB/RB/WR/TE/FLEX/D/ST/K, or BE/IR for bench)
}
export interface BoxSide {
  teamId: number;
  ownerId: string | null;
  teamName: string;
  abbrev: string;
  total: number;
  benchTotal: number;
  starters: BoxPlayer[];
  bench: BoxPlayer[];
}
export interface BoxGame {
  mp: number;
  tier: PlayoffTier;
  winner: 'HOME' | 'AWAY' | 'TIE';
  home: BoxSide;
  away: BoxSide;
}
export interface SeasonBox {
  year: number;
  weeks: Record<string, BoxGame[]>;
}

// ---- roster age (public/data/roster-age/{year}.json), 2018+ ----
export interface RosterAgePlayer {
  playerId: number;
  name: string;
  age: number;
}
export interface RosterAgeTeam {
  teamId: number;
  ownerId: string | null;
  teamName: string;
  avgAge: number;
  oldest: RosterAgePlayer[];
  youngest: RosterAgePlayer[];
}
export interface SeasonRosterAge {
  year: number;
  teams: RosterAgeTeam[];
}

export interface League {
  meta: Meta;
  owners: Owner[];
  seasons: Season[];
  headToHead: HeadToHead;
  ownerNames: Record<string, string>;
  records: Records;
  championsTimeline: ChampRow[];
}
