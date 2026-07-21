// Transform raw ESPN season files into a single computed league.json for the app.
// Output: src/data/league.json
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, RAW_DIR, PLAYERS_DIR, readJSON, writeJSON } from './lib.mjs';

const SEASONS = fs
  .readdirSync(RAW_DIR)
  .filter((f) => /^\d{4}\.json$/.test(f))
  .map((f) => Number(f.slice(0, 4)))
  .sort((a, b) => a - b);

const POS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST', 9: 'DL', 10: 'LB', 11: 'DB', 12: 'DB', 13: 'DL', 14: 'LB' };
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---- owner (person) registry, keyed by ESPN member id (stable across seasons) ----
// Some managers used different ESPN accounts across years; we canonicalize by real
// name so one person == one franchise history. Every merge is logged for transparency.
const owners = new Map(); // canonicalId -> owner object
const memberToCanonical = new Map(); // any member id -> canonical owner id
const nameToCanonical = new Map(); // normalized "first last" -> canonical owner id
const merges = [];
function friendlyName(m) {
  const fn = (m.firstName || '').trim();
  const ln = (m.lastName || '').trim();
  const full = `${fn} ${ln}`.trim();
  if (full && full.toLowerCase() !== 'undefined') return full;
  return (m.displayName || '').trim() || 'Unknown Manager';
}
function normName(m) {
  if (!m) return null;
  const full = `${(m.firstName || '').trim()} ${(m.lastName || '').trim()}`.trim().toLowerCase();
  return full && full !== 'undefined' ? full : null;
}
function canonicalId(memberId, member) {
  if (memberToCanonical.has(memberId)) return memberToCanonical.get(memberId);
  const nk = normName(member);
  let canon = memberId;
  if (nk) {
    if (nameToCanonical.has(nk)) {
      canon = nameToCanonical.get(nk);
      if (canon !== memberId) merges.push(`${friendlyName(member)}: ${memberId} -> ${canon}`);
    } else {
      nameToCanonical.set(nk, memberId);
    }
  }
  memberToCanonical.set(memberId, canon);
  return canon;
}
function ensureOwner(id, member) {
  if (!owners.has(id)) {
    owners.set(id, {
      id,
      name: member ? friendlyName(member) : 'Unknown Manager',
      displayName: member?.displayName || '',
      aliases: new Set(),
      seasons: [], // per-season records, filled below
      teamNames: new Set(),
    });
  } else if (member) {
    // prefer a real name if we learn one later
    const o = owners.get(id);
    if (o.name === 'Unknown Manager') o.name = friendlyName(member);
    if (!o.displayName) o.displayName = member.displayName || '';
  }
  return owners.get(id);
}

// ---- per-team-week scores (single NFL week) for records ----
const teamWeeks = []; // {year, week, ownerId, teamId, score}
// ---- flat matchup log (one per game) ----
const allGames = []; // {year, mp, tier, isReg, isPlayoff, isConsolation, home:{ownerId,teamId,score}, away:{...}, winner}

const seasonsOut = [];

for (const year of SEASONS) {
  const raw = readifExists(path.join(RAW_DIR, `${year}.json`));
  if (!raw) continue;
  const playerMap = readifExists(path.join(PLAYERS_DIR, `${year}.json`)) || {};

  const members = raw.members || [];
  const memberById = new Map(members.map((m) => [m.id, m]));
  const sched = raw.settings?.scheduleSettings || {};
  const regWeeks = sched.matchupPeriodCount ?? 14;
  const divisions = new Map((sched.divisions || []).map((d) => [d.id, d.name]));
  const nTeams = raw.teams.length;

  // team -> owner id resolution
  const teamOwner = new Map();
  const teamMeta = new Map();
  for (const t of raw.teams) {
    const rawOid = t.primaryOwner || t.owners?.[0] || `ghost-${year}-${t.id}`;
    const member = memberById.get(rawOid);
    const oid = canonicalId(rawOid, member);
    ensureOwner(oid, member).aliases.add(rawOid);
    const teamName = (t.name || `${t.location || ''} ${t.nickname || ''}`).trim() || `Team ${t.id}`;
    teamOwner.set(t.id, oid);
    teamMeta.set(t.id, {
      teamId: t.id,
      ownerId: oid,
      teamName,
      abbrev: t.abbrev || '',
      logo: t.logo || '',
      division: divisions.get(t.divisionId) || null,
      finalRank: t.rankCalculatedFinal > 0 ? t.rankCalculatedFinal : t.rankFinal || t.playoffSeed || null,
      playoffSeed: t.playoffSeed || null,
    });
    owners.get(oid).teamNames.add(teamName);
  }

  // accumulate per-team season stats from the schedule
  const stat = new Map(); // teamId -> {w,l,t,pf,pa, regW,regL,regT,regPF, poW,poL, weeks:[]}
  const S = (tid) => {
    if (!stat.has(tid)) stat.set(tid, { w: 0, l: 0, t: 0, pf: 0, pa: 0, regW: 0, regL: 0, regT: 0, regPF: 0, regPA: 0, poW: 0, poL: 0, madePlayoffs: false, weeks: [], nWeeks: 0 });
    return stat.get(tid);
  };

  const seasonMatchups = [];
  const regWeekScores = []; // regular-season single-NFL-week team scores (era-consistent)
  for (const g of raw.schedule || []) {
    const home = g.home, away = g.away;
    if (!home || !away || home.teamId == null || away.teamId == null) continue;
    const tier = g.playoffTierType || 'NONE';
    const isReg = tier === 'NONE';
    const isPlayoff = tier === 'WINNERS_BRACKET';
    const isConsolation = tier.includes('CONSOLATION');
    const winner = g.winner || 'UNDECIDED';
    if (winner === 'UNDECIDED') continue; // unplayed
    const hs = round2(home.totalPoints || 0);
    const as = round2(away.totalPoints || 0);
    // skip phantom 0-0 games
    if (hs === 0 && as === 0) continue;

    const hOwner = teamOwner.get(home.teamId);
    const aOwner = teamOwner.get(away.teamId);
    const hS = S(home.teamId), aS = S(away.teamId);

    hS.pf += hs; hS.pa += as; aS.pf += as; aS.pa += hs;
    if (winner === 'HOME') { hS.w++; aS.l++; }
    else if (winner === 'AWAY') { aS.w++; hS.l++; }
    else { hS.t++; aS.t++; }

    if (isReg) {
      hS.regPF += hs; hS.regPA += as; aS.regPF += as; aS.regPA += hs;
      if (winner === 'HOME') { hS.regW++; aS.regL++; }
      else if (winner === 'AWAY') { aS.regW++; hS.regL++; }
      else { hS.regT++; aS.regT++; }
    }
    if (isPlayoff) {
      hS.madePlayoffs = true; aS.madePlayoffs = true;
      if (winner === 'HOME') { hS.poW++; aS.poL++; }
      else if (winner === 'AWAY') { aS.poW++; hS.poL++; }
    }

    // per-NFL-week scores (records + era-consistent per-week aggregates)
    for (const [side, obj, oid, tid] of [['home', home, hOwner, home.teamId], ['away', away, aOwner, away.teamId]]) {
      const pbsp = obj.pointsByScoringPeriod || {};
      const s = S(tid);
      for (const [sp, pts] of Object.entries(pbsp)) {
        const v = round2(pts);
        teamWeeks.push({ year, week: Number(sp), ownerId: oid, teamId: tid, score: v });
        s.weeks.push(v); // single-NFL-week scores (true high/low week)
        s.nWeeks += 1;
        if (isReg) regWeekScores.push(v);
      }
    }

    // 2-week playoff matchups double the score; flag true single-NFL-week games so
    // matchup-level records (blowouts, shootouts) stay apples-to-apples.
    const hSP = Object.keys(home.pointsByScoringPeriod || {}).length;
    const aSP = Object.keys(away.pointsByScoringPeriod || {}).length;
    const singleWeek = hSP <= 1 && aSP <= 1;
    const mObj = {
      year, mp: g.matchupPeriodId, tier, isReg, isPlayoff, isConsolation, singleWeek, winner,
      home: { ownerId: hOwner, teamId: home.teamId, score: hs },
      away: { ownerId: aOwner, teamId: away.teamId, score: as },
    };
    seasonMatchups.push(mObj);
    allGames.push(mObj);
  }

  // regular-season ranking (win% then PF)
  const regRankOrder = [...teamMeta.keys()].sort((a, b) => {
    const A = S(a), B = S(b);
    const aw = A.regW + A.regT * 0.5, bw = B.regW + B.regT * 0.5;
    const agp = A.regW + A.regL + A.regT || 1, bgp = B.regW + B.regL + B.regT || 1;
    const apct = aw / agp, bpct = bw / bgp;
    if (bpct !== apct) return bpct - apct;
    return B.regPF - A.regPF;
  });
  const regRank = new Map(regRankOrder.map((tid, i) => [tid, i + 1]));

  // assemble season teams
  const teams = [...teamMeta.values()].map((tm) => {
    const s = S(tm.teamId);
    return {
      ...tm,
      wins: s.w, losses: s.l, ties: s.t,
      pf: round2(s.pf), pa: round2(s.pa),
      weeks: s.nWeeks,
      ppg: s.nWeeks ? round2(s.pf / s.nWeeks) : 0,
      regWins: s.regW, regLosses: s.regL, regTies: s.regT,
      regRank: regRank.get(tm.teamId) || null,
      madePlayoffs: s.madePlayoffs,
      playoffWins: s.poW, playoffLosses: s.poL,
      highWeek: s.weeks.length ? Math.max(...s.weeks) : 0,
      lowWeek: s.weeks.length ? Math.min(...s.weeks) : 0,
    };
  });
  teams.sort((a, b) => (a.finalRank || 99) - (b.finalRank || 99));

  const byFinal = (r) => teams.find((t) => t.finalRank === r) || null;
  const champion = byFinal(1);
  const runnerUp = byFinal(2);
  const third = byFinal(3);
  const sacko = teams.reduce((lo, t) => ((t.finalRank || 0) > (lo?.finalRank || 0) ? t : lo), null);
  const regChamp = teams.find((t) => t.regRank === 1) || null;
  const topScorer = [...teams].sort((a, b) => b.pf - a.pf)[0] || null;

  // draft
  const picks = (raw.draftDetail?.picks || []).map((p) => {
    const pl = playerMap[p.playerId] || {};
    return {
      overall: p.overallPickNumber,
      round: p.roundId,
      roundPick: p.roundPickNumber,
      ownerId: teamOwner.get(p.teamId) || p.memberId || null,
      teamId: p.teamId,
      playerId: p.playerId,
      playerName: pl.name || `Player ${p.playerId}`,
      pos: POS[pl.pos] || (pl.pos != null ? String(pl.pos) : '—'),
      bid: p.bidAmount || 0,
      keeper: !!p.keeper,
    };
  });
  const draftType = picks.some((p) => p.bid > 0) ? 'auction' : 'snake';

  seasonsOut.push({
    year, nTeams, regWeeks, draftType,
    avgScore: regWeekScores.length ? round2(regWeekScores.reduce((a, b) => a + b, 0) / regWeekScores.length) : 0,
    divisions: [...divisions.values()],
    champion: podium(champion), runnerUp: podium(runnerUp), third: podium(third),
    sacko: podium(sacko), regSeasonChamp: podium(regChamp),
    highestScorer: topScorer ? { ...podium(topScorer), pf: topScorer.pf } : null,
    teams,
    matchups: seasonMatchups,
    draft: { type: draftType, picks },
  });

  // record per-season into each owner
  for (const t of teams) {
    ensureOwner(t.ownerId).seasons.push({
      year, teamName: t.teamName, abbrev: t.abbrev, division: t.division,
      wins: t.wins, losses: t.losses, ties: t.ties, pf: t.pf, pa: t.pa, ppg: t.ppg, weeks: t.weeks,
      regWins: t.regWins, regLosses: t.regLosses, regRank: t.regRank,
      finalRank: t.finalRank, playoffSeed: t.playoffSeed,
      madePlayoffs: t.madePlayoffs, playoffWins: t.playoffWins,
      champion: t.finalRank === 1, runnerUp: t.finalRank === 2,
      last: t.finalRank === nTeams,
      highWeek: t.highWeek, lowWeek: t.lowWeek,
    });
  }
}

function podium(t) {
  if (!t) return null;
  return { ownerId: t.ownerId, teamName: t.teamName, abbrev: t.abbrev, wins: t.wins, losses: t.losses, ties: t.ties };
}
function readifExists(p) {
  return fs.existsSync(p) ? readJSON(p) : null;
}

// ---- owner all-time aggregates ----
const ownersOut = [];
for (const o of owners.values()) {
  if (!o.seasons.length) continue;
  o.seasons.sort((a, b) => a.year - b.year);
  const A = { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, weeks: 0, regWins: 0, regLosses: 0, playoffWins: 0 };
  let championships = 0, runnerUps = 0, lasts = 0, playoffApps = 0;
  const finishes = [];
  for (const s of o.seasons) {
    A.wins += s.wins; A.losses += s.losses; A.ties += s.ties;
    A.pf += s.pf; A.pa += s.pa; A.weeks += s.weeks;
    A.regWins += s.regWins; A.regLosses += s.regLosses;
    A.playoffWins += s.playoffWins;
    if (s.champion) championships++;
    if (s.runnerUp) runnerUps++;
    if (s.last) lasts++;
    if (s.madePlayoffs) playoffApps++;
    if (s.finalRank) finishes.push(s.finalRank);
  }
  const gp = A.wins + A.losses + A.ties;
  ownersOut.push({
    id: o.id,
    name: o.name,
    displayName: o.displayName,
    aliases: [...o.aliases],
    teamNames: [...o.teamNames],
    seasonsPlayed: o.seasons.map((s) => s.year),
    nSeasons: o.seasons.length,
    seasons: o.seasons,
    allTime: {
      wins: A.wins, losses: A.losses, ties: A.ties, gamesPlayed: gp,
      pct: gp ? Math.round(((A.wins + A.ties * 0.5) / gp) * 1e4) / 1e4 : 0,
      pf: round2(A.pf), pa: round2(A.pa),
      ppg: A.weeks ? round2(A.pf / A.weeks) : 0,
      papg: A.weeks ? round2(A.pa / A.weeks) : 0,
      diff: round2(A.pf - A.pa),
      regWins: A.regWins, regLosses: A.regLosses,
      playoffWins: A.playoffWins,
      championships, runnerUps, lasts, playoffApps,
      avgFinish: finishes.length ? round2(finishes.reduce((a, b) => a + b, 0) / finishes.length) : null,
      bestFinish: finishes.length ? Math.min(...finishes) : null,
      worstFinish: finishes.length ? Math.max(...finishes) : null,
      titles: o.seasons.filter((s) => s.champion).map((s) => s.year),
    },
  });
}
ownersOut.sort((a, b) => b.allTime.championships - a.allTime.championships || b.allTime.wins - a.allTime.wins);

// ---- head-to-head matrix (all games) ----
const nameById = new Map(ownersOut.map((o) => [o.id, o.name]));
const h2h = {}; // a -> b -> {w,l,t,pf,pa}
const bump = (a, b, ptsFor, ptsAgainst, res) => {
  h2h[a] ??= {};
  h2h[a][b] ??= { w: 0, l: 0, t: 0, pf: 0, pa: 0 };
  const c = h2h[a][b];
  c.pf = round2(c.pf + ptsFor); c.pa = round2(c.pa + ptsAgainst);
  if (res === 'w') c.w++; else if (res === 'l') c.l++; else c.t++;
};
for (const g of allGames) {
  const a = g.home.ownerId, b = g.away.ownerId;
  if (!a || !b || a === b) continue;
  const hres = g.winner === 'HOME' ? 'w' : g.winner === 'AWAY' ? 'l' : 't';
  const ares = hres === 'w' ? 'l' : hres === 'l' ? 'w' : 't';
  bump(a, b, g.home.score, g.away.score, hres);
  bump(b, a, g.away.score, g.home.score, ares);
}

// ---- streaks (chronological, all games) ----
const streaks = {}; // ownerId -> {curW,curL,maxW,maxL, maxWspan, maxLspan}
const chron = [...allGames].sort((x, y) => x.year - y.year || x.mp - y.mp);
const st = (id) => (streaks[id] ??= { curW: 0, curL: 0, maxW: 0, maxL: 0, maxWspan: null, maxLspan: null, _wStart: null, _lStart: null });
for (const g of chron) {
  for (const [meId, opId, res] of [
    [g.home.ownerId, g.away.ownerId, g.winner === 'HOME' ? 'w' : g.winner === 'AWAY' ? 'l' : 't'],
    [g.away.ownerId, g.home.ownerId, g.winner === 'AWAY' ? 'w' : g.winner === 'HOME' ? 'l' : 't'],
  ]) {
    if (!meId) continue;
    const s = st(meId);
    if (res === 'w') {
      if (s.curW === 0) s._wStart = g.year;
      s.curW++; s.curL = 0;
      if (s.curW > s.maxW) { s.maxW = s.curW; s.maxWspan = `${s._wStart}–${g.year}`; }
    } else if (res === 'l') {
      if (s.curL === 0) s._lStart = g.year;
      s.curL++; s.curW = 0;
      if (s.curL > s.maxL) { s.maxL = s.curL; s.maxLspan = `${s._lStart}–${g.year}`; }
    } else { s.curW = 0; s.curL = 0; }
  }
}

// ---- records book ----
const withName = (tw) => ({ ...tw, owner: nameById.get(tw.ownerId) || 'Unknown' });
const topWeeks = [...teamWeeks].filter((w) => w.score > 0).sort((a, b) => b.score - a.score).slice(0, 30).map(withName);
const lowWeeks = [...teamWeeks].filter((w) => w.score > 0).sort((a, b) => a.score - b.score).slice(0, 30).map(withName);

// game-level records — restrict to true single-NFL-week games for fair comparison
const gameRows = allGames.filter((g) => g.singleWeek).map((g) => {
  const margin = round2(Math.abs(g.home.score - g.away.score));
  const combined = round2(g.home.score + g.away.score);
  const winSide = g.home.score >= g.away.score ? g.home : g.away;
  const loseSide = g.home.score >= g.away.score ? g.away : g.home;
  return { ...g, margin, combined, winSide, loseSide };
});
const named = (side) => nameById.get(side.ownerId) || 'Unknown';
const blowouts = [...gameRows].filter((g) => g.winner !== 'TIE').sort((a, b) => b.margin - a.margin).slice(0, 15)
  .map((g) => ({ year: g.year, week: g.mp, tier: g.tier, margin: g.margin, winner: named(g.winSide), winScore: g.winSide.score, loser: named(g.loseSide), loseScore: g.loseSide.score }));
const nailbiters = [...gameRows].filter((g) => g.winner !== 'TIE' && g.margin > 0).sort((a, b) => a.margin - b.margin).slice(0, 15)
  .map((g) => ({ year: g.year, week: g.mp, tier: g.tier, margin: g.margin, winner: named(g.winSide), winScore: g.winSide.score, loser: named(g.loseSide), loseScore: g.loseSide.score }));
const shootouts = [...gameRows].sort((a, b) => b.combined - a.combined).slice(0, 15)
  .map((g) => ({ year: g.year, week: g.mp, tier: g.tier, combined: g.combined, home: named(g.home), homeScore: g.home.score, away: named(g.away), awayScore: g.away.score }));
const mostInLoss = [...gameRows].filter((g) => g.winner !== 'TIE').sort((a, b) => b.loseSide.score - a.loseSide.score).slice(0, 15)
  .map((g) => ({ year: g.year, week: g.mp, tier: g.tier, owner: named(g.loseSide), score: g.loseSide.score, oppScore: g.winSide.score, opp: named(g.winSide) }));
const fewestInWin = [...gameRows].filter((g) => g.winner !== 'TIE').sort((a, b) => a.winSide.score - b.winSide.score).slice(0, 15)
  .map((g) => ({ year: g.year, week: g.mp, tier: g.tier, owner: named(g.winSide), score: g.winSide.score, oppScore: g.loseSide.score, opp: named(g.loseSide) }));

// season-level PF records
const seasonScoring = [];
for (const s of seasonsOut) for (const t of s.teams) seasonScoring.push({ year: s.year, owner: nameById.get(t.ownerId) || 'Unknown', teamName: t.teamName, pf: t.pf, pa: t.pa, wins: t.wins, losses: t.losses, ppg: t.ppg });
const bestSeasonPF = [...seasonScoring].sort((a, b) => b.pf - a.pf).slice(0, 15);
const worstSeasonPF = [...seasonScoring].sort((a, b) => a.pf - b.pf).slice(0, 15);

const streakBoard = Object.entries(streaks).map(([id, s]) => ({ owner: nameById.get(id) || 'Unknown', ownerId: id, maxW: s.maxW, maxWspan: s.maxWspan, maxL: s.maxL, maxLspan: s.maxLspan }));
const longestWin = [...streakBoard].sort((a, b) => b.maxW - a.maxW).slice(0, 10);
const longestLose = [...streakBoard].sort((a, b) => b.maxL - a.maxL).slice(0, 10);

// biggest auction bids all-time
const allBids = [];
for (const s of seasonsOut) if (s.draft.type === 'auction') for (const p of s.draft.picks) if (p.bid > 0) allBids.push({ year: s.year, owner: nameById.get(p.ownerId) || 'Unknown', player: p.playerName, pos: p.pos, bid: p.bid });
const biggestBids = [...allBids].sort((a, b) => b.bid - a.bid).slice(0, 20);

const records = {
  topWeeks, lowWeeks, blowouts, nailbiters, shootouts, mostInLoss, fewestInWin,
  bestSeasonPF, worstSeasonPF, longestWin, longestLose, biggestBids,
  singleHigh: topWeeks[0], singleLow: lowWeeks[0],
  biggestBlowout: blowouts[0], closestGame: nailbiters[0], highestShootout: shootouts[0],
};

// ---- champions timeline ----
const championsTimeline = seasonsOut.map((s) => ({
  year: s.year,
  champion: s.champion ? { ownerId: s.champion.ownerId, owner: nameById.get(s.champion.ownerId) || 'Unknown', teamName: s.champion.teamName, abbrev: s.champion.abbrev } : null,
  runnerUp: s.runnerUp ? { owner: nameById.get(s.runnerUp.ownerId) || 'Unknown', teamName: s.runnerUp.teamName } : null,
  sacko: s.sacko ? { owner: nameById.get(s.sacko.ownerId) || 'Unknown', teamName: s.sacko.teamName } : null,
  regChamp: s.regSeasonChamp ? { owner: nameById.get(s.regSeasonChamp.ownerId) || 'Unknown', teamName: s.regSeasonChamp.teamName } : null,
}));

const out = {
  meta: {
    leagueName: 'AFFL',
    leagueId: 51418,
    seasons: SEASONS,
    firstSeason: SEASONS[0],
    lastSeason: SEASONS[SEASONS.length - 1],
    nSeasons: SEASONS.length,
    nOwners: ownersOut.length,
    generatedAt: new Date().toISOString(),
  },
  owners: ownersOut,
  seasons: seasonsOut,
  headToHead: h2h,
  ownerNames: Object.fromEntries(nameById),
  records,
  championsTimeline,
};

const outPath = path.join(ROOT, 'public', 'data', 'league.json');
writeJSON(outPath, out);
const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
console.log(`Wrote ${outPath} (${kb} KB)`);
console.log(`Seasons: ${SEASONS.join(', ')}`);
console.log(`Owners: ${ownersOut.length}`);
if (merges.length) console.log(`Merged duplicate accounts:\n  ${merges.join('\n  ')}`);
console.log('Champions:');
for (const c of championsTimeline) console.log(`  ${c.year}: ${c.champion?.owner ?? '—'} (${c.champion?.teamName ?? '—'})`);
console.log('\nTitle counts:');
for (const o of ownersOut.filter((o) => o.allTime.championships > 0)) console.log(`  ${o.allTime.championships}x  ${o.name}  [${o.allTime.titles.join(', ')}]`);
