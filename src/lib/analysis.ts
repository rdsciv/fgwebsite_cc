// Joins weekly boxscores (rostered players) with the auction draft (playerId) AND the
// transaction log to attribute each team's points by HOW the player was acquired —
// own draft pick, trade, waiver, or free agent — and to value rosters at draft-day prices.
import type { BoxSide, Season, SeasonBox } from '../types';
import type { AcqEvent } from './transactions';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface TeamRosterAnalysis {
  teamId: number;
  ownerId: string;
  teamName: string;
  draftSpend: number; // total auction $ spent at the draft
  starterPts: number; // total points from starters, all weeks
  ptsDraft: number; // starter points from players THIS team drafted (and kept)
  ptsTrade: number; // starter points from players acquired via trade
  ptsWaiver: number; // starter points from players claimed off waivers
  ptsFA: number; // starter points from free-agent adds
  finalRosterCost: number; // draft-day $ value of the season-ending roster
  finalRosterDrafted: number; // # of season-ending roster players who were drafted (by anyone)
  finalRosterSize: number;
}

export interface PickROI {
  ownerId: string | null;
  playerId: number;
  player: string;
  pos: string;
  bid: number;
  pts: number; // points the player scored as a starter for the drafting team (before being traded away)
  totalPts: number; // total points the player scored as a starter for ANY team
  traded: boolean; // did the drafter trade this player away?
  ppd: number | null; // points per draft dollar (null when bid is 0)
}

export interface TradePlayer {
  pid: number;
  name: string;
  pos: string;
  ptsForNewTeam: number; // starter points this player scored for the team that received him
  totalPts: number;
}
export interface Trade {
  when: string; // 'Preseason' or 'Week N'
  wk: number; // sort key (0 = preseason)
  aTeamId: number;
  bTeamId: number;
  aOwnerId: string;
  bOwnerId: string;
  aName: string;
  bName: string;
  aSends: TradePlayer[]; // players team A sent to team B
  bSends: TradePlayer[]; // players team B sent to team A
  aGot: number; // points team A got from the players it received (bSends), while on A
  bGot: number; // points team B got from the players it received (aSends), while on B
}

export interface SeasonAnalysis {
  teams: TeamRosterAnalysis[];
  picks: PickROI[];
  trades: Trade[];
}

// Bin a single player-week: 'D' draft, 'T' trade, 'W' waiver, 'F' free agent.
// Waiver/FA adds are logged directly; draft is seeded from the picks; a player on a team
// he wasn't drafted by and has no waiver/FA claim for arrived via trade.
type Bin = 'D' | 'T' | 'W' | 'F';
function classify(events: { m: Bin; sp: number }[] | undefined, wasDrafted: boolean, wk: number): Bin {
  if (events && events.length) {
    let latest: { m: Bin; sp: number } | null = null;
    for (const e of events) if (e.sp <= wk && (!latest || e.sp >= latest.sp)) latest = e;
    if (latest) return latest.m;
    return events[0].m; // joined just after this week (timing) — use how he first arrived
  }
  return wasDrafted ? 'T' : 'F';
}

export function computeSeasonAnalysis(box: SeasonBox, season: Season, txEvents: AcqEvent[] = []): SeasonAnalysis {
  const draft = new Map<number, { teamId: number; ownerId: string | null; bid: number }>();
  for (const p of season.draft.picks) draft.set(p.playerId, { teamId: p.teamId, ownerId: p.ownerId, bid: p.bid });
  const draftedAnywhere = new Set(season.draft.picks.map((p) => p.playerId));

  // acquisition events keyed by player+team (draft seed sp 0, then waiver/FA/trade adds)
  const ev = new Map<string, { m: Bin; sp: number }[]>();
  const key = (pid: number, team: number) => `${pid}|${team}`;
  const addEv = (pid: number, team: number, m: Bin, sp: number) => {
    const k = key(pid, team);
    let arr = ev.get(k);
    if (!arr) ev.set(k, (arr = []));
    arr.push({ m, sp });
  };
  for (const p of season.draft.picks) addEv(p.playerId, p.teamId, 'D', 0);
  for (const e of txEvents) addEv(e.pid, e.team, e.m as Bin, e.sp);
  for (const arr of ev.values()) arr.sort((a, b) => a.sp - b.sp);

  const teamById = new Map(season.teams.map((t) => [t.teamId, t]));
  const agg = new Map<number, { ptsDraft: number; ptsTrade: number; ptsWaiver: number; ptsFA: number; starterPts: number }>();
  const A = (tid: number) => {
    let a = agg.get(tid);
    if (!a) agg.set(tid, (a = { ptsDraft: 0, ptsTrade: 0, ptsWaiver: 0, ptsFA: 0, starterPts: 0 }));
    return a;
  };
  const pickPts = new Map<number, number>(); // playerId -> points as a starter for the drafting team
  const lastWeek = new Map<number, { wk: number; side: BoxSide }>();
  // ground-truth roster movement + per-(player,team) scoring, for exact trade reconstruction
  const teamOf = new Map<number, Map<number, number>>(); // pid -> (week -> teamId)   (starters + bench)
  const starterByPidTeam = new Map<string, number>(); // `pid|team` -> starter points
  const totalByPid = new Map<number, number>(); // pid -> total starter points (any team)
  const playerMeta = new Map<number, { name: string; pos: string }>();

  for (const [wkStr, games] of Object.entries(box.weeks)) {
    const wk = Number(wkStr);
    for (const g of games) {
      for (const side of [g.home, g.away]) {
        const tid = side.teamId;
        const a = A(tid);
        for (const p of side.starters) {
          a.starterPts += p.pt;
          starterByPidTeam.set(key(p.id, tid), (starterByPidTeam.get(key(p.id, tid)) ?? 0) + p.pt);
          totalByPid.set(p.id, (totalByPid.get(p.id) ?? 0) + p.pt);
          const bin = classify(ev.get(key(p.id, tid)), draftedAnywhere.has(p.id), wk);
          if (bin === 'D') {
            a.ptsDraft += p.pt;
            pickPts.set(p.id, (pickPts.get(p.id) ?? 0) + p.pt);
          } else if (bin === 'T') a.ptsTrade += p.pt;
          else if (bin === 'W') a.ptsWaiver += p.pt;
          else a.ptsFA += p.pt;
        }
        for (const p of [...side.starters, ...side.bench]) {
          if (!teamOf.has(p.id)) teamOf.set(p.id, new Map());
          teamOf.get(p.id)!.set(wk, tid);
          if (!playerMeta.has(p.id)) playerMeta.set(p.id, { name: p.n, pos: p.p });
        }
        const prev = lastWeek.get(tid);
        if (!prev || wk > prev.wk) lastWeek.set(tid, { wk, side });
      }
    }
  }

  // ---- reconstruct exact trades from roster movement (ground truth) ----
  const trades = reconstructTrades({
    teamOf,
    draftTeam: new Map(season.draft.picks.map((p) => [p.playerId, p.teamId])),
    wfEvents: txEvents.filter((e) => e.m === 'W' || e.m === 'F'),
    playerMeta,
    starterByPidTeam,
    totalByPid,
    teamName: (tid) => teamById.get(tid)?.teamName ?? `Team ${tid}`,
    ownerOf: (tid) => teamById.get(tid)?.ownerId ?? '',
  });
  // players a drafter traded away (used to exclude them from the bust list)
  const tradedAwayByDrafter = new Set<number>();
  for (const tr of trades) {
    for (const tp of tr.aSends) if (draft.get(tp.pid)?.teamId === tr.aTeamId) tradedAwayByDrafter.add(tp.pid);
    for (const tp of tr.bSends) if (draft.get(tp.pid)?.teamId === tr.bTeamId) tradedAwayByDrafter.add(tp.pid);
  }

  const spendByTeam = new Map<number, number>();
  for (const p of season.draft.picks) spendByTeam.set(p.teamId, (spendByTeam.get(p.teamId) ?? 0) + p.bid);

  const teams: TeamRosterAnalysis[] = [];
  for (const [tid, a] of agg) {
    const t = teamById.get(tid);
    const roster = lastWeek.get(tid)?.side;
    const final = roster ? [...roster.starters, ...roster.bench] : [];
    let cost = 0;
    let drafted = 0;
    for (const p of final) {
      const d = draft.get(p.id);
      if (d) {
        cost += d.bid;
        drafted++;
      }
    }
    teams.push({
      teamId: tid,
      ownerId: t?.ownerId ?? '',
      teamName: t?.teamName ?? `Team ${tid}`,
      draftSpend: round2(spendByTeam.get(tid) ?? 0),
      starterPts: round2(a.starterPts),
      ptsDraft: round2(a.ptsDraft),
      ptsTrade: round2(a.ptsTrade),
      ptsWaiver: round2(a.ptsWaiver),
      ptsFA: round2(a.ptsFA),
      finalRosterCost: round2(cost),
      finalRosterDrafted: drafted,
      finalRosterSize: final.length,
    });
  }
  teams.sort((x, y) => y.starterPts - x.starterPts);

  const picks: PickROI[] = season.draft.picks.map((p) => {
    const pts = round2(pickPts.get(p.playerId) ?? 0);
    return {
      ownerId: p.ownerId,
      playerId: p.playerId,
      player: p.playerName,
      pos: p.pos,
      bid: p.bid,
      pts,
      totalPts: round2(totalByPid.get(p.playerId) ?? 0),
      traded: tradedAwayByDrafter.has(p.playerId),
      ppd: p.bid > 0 ? round2(pts / p.bid) : null,
    };
  });

  return { teams, picks, trades };
}

// Reconstruct trades from weekly rosters: a player who changes teams without a waiver/FA
// claim moved via trade; simultaneous moves between the same two teams form one trade.
function reconstructTrades(ctx: {
  teamOf: Map<number, Map<number, number>>;
  draftTeam: Map<number, number>;
  wfEvents: AcqEvent[];
  playerMeta: Map<number, { name: string; pos: string }>;
  starterByPidTeam: Map<string, number>;
  totalByPid: Map<number, number>;
  teamName: (tid: number) => string;
  ownerOf: (tid: number) => string;
}): Trade[] {
  const { teamOf, draftTeam, wfEvents, playerMeta, starterByPidTeam, totalByPid, teamName, ownerOf } = ctx;
  const claims = new Map<number, AcqEvent[]>();
  for (const e of wfEvents) {
    if (!claims.has(e.pid)) claims.set(e.pid, []);
    claims.get(e.pid)!.push(e);
  }
  const hasClaim = (pid: number, team: number, lo: number, hi: number) =>
    (claims.get(pid) ?? []).some((e) => e.team === team && e.sp >= lo - 1 && e.sp <= hi + 1);

  // trade movements: (pid, from, to, wk-bucket)
  type Move = { pid: number; from: number; to: number; wk: number; bucket: string };
  const moves: Move[] = [];
  for (const [pid, tm] of teamOf) {
    const wl = [...tm.keys()].sort((a, b) => a - b);
    const first = wl[0];
    const dft = draftTeam.get(pid);
    if (dft != null && dft !== tm.get(first) && !hasClaim(pid, tm.get(first)!, 0, first))
      moves.push({ pid, from: dft, to: tm.get(first)!, wk: 0, bucket: `0|${[dft, tm.get(first)!].sort((a, b) => a - b).join('-')}` });
    for (let i = 1; i < wl.length; i++) {
      const a = tm.get(wl[i - 1])!;
      const b = tm.get(wl[i])!;
      if (a !== b && !hasClaim(pid, b, wl[i - 1], wl[i]))
        moves.push({ pid, from: a, to: b, wk: wl[i], bucket: `${wl[i]}|${[a, b].sort((x, y) => x - y).join('-')}` });
    }
  }

  const groups = new Map<string, Move[]>();
  for (const mv of moves) {
    if (!groups.has(mv.bucket)) groups.set(mv.bucket, []);
    groups.get(mv.bucket)!.push(mv);
  }

  const mkPlayer = (pid: number, newTeam: number): TradePlayer => ({
    pid,
    name: playerMeta.get(pid)?.name ?? `Player ${pid}`,
    pos: playerMeta.get(pid)?.pos ?? '—',
    ptsForNewTeam: round2(starterByPidTeam.get(`${pid}|${newTeam}`) ?? 0),
    totalPts: round2(totalByPid.get(pid) ?? 0),
  });

  const trades: Trade[] = [];
  for (const [bucket, mvs] of groups) {
    const [wkStr, pair] = bucket.split('|');
    const [A, B] = pair.split('-').map(Number);
    const aSends = mvs.filter((m) => m.from === A).map((m) => mkPlayer(m.pid, B));
    const bSends = mvs.filter((m) => m.from === B).map((m) => mkPlayer(m.pid, A));
    if (!aSends.length || !bSends.length) continue; // keep confirmed bilateral trades only
    const wk = Number(wkStr);
    trades.push({
      when: wk === 0 ? 'Preseason' : `Week ${wk}`,
      wk,
      aTeamId: A,
      bTeamId: B,
      aOwnerId: ownerOf(A),
      bOwnerId: ownerOf(B),
      aName: teamName(A),
      bName: teamName(B),
      aSends,
      bSends,
      aGot: round2(bSends.reduce((s, p) => s + p.ptsForNewTeam, 0)),
      bGot: round2(aSends.reduce((s, p) => s + p.ptsForNewTeam, 0)),
    });
  }
  trades.sort((x, y) => x.wk - y.wk);
  return trades;
}
