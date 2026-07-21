// Fetch + transform full weekly boxscores (starters + bench, player points) for seasons
// where ESPN exposes player-level data (2018+). Writes public/data/boxscores/{year}.json.
// Usage: node scripts/build-boxscores.mjs [--force] [year...]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadEnv, espnFetch, readJSON, writeJSON } from './lib.mjs';

const { leagueId, swid, s2 } = loadEnv();
const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyYears = args.filter((a) => /^\d{4}$/.test(a)).map(Number);

// ESPN player-level boxscores are only available from the per-season endpoint (2018+).
const BOX_SEASONS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const YEARS = onlyYears.length ? onlyYears.filter((y) => BOX_SEASONS.includes(y)) : BOX_SEASONS;

const POS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
const SLOT = {
  0: 'QB', 1: 'QB', 2: 'RB', 3: 'RB/WR', 4: 'WR', 5: 'WR/TE', 6: 'TE', 7: 'OP',
  16: 'D/ST', 17: 'K', 23: 'FLEX',
};
const PRO = {
  0: 'FA', 1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
  9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN', 17: 'NE',
  18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC', 25: 'SF', 26: 'SEA',
  27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU',
};
const BENCH = 20, IR = 21;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// team -> {ownerId, teamName, abbrev} per season, from the already-computed league.json
const league = readJSON(path.join(ROOT, 'public', 'data', 'league.json'));
const seasonById = new Map(league.seasons.map((s) => [s.year, s]));

async function seasonWeek(year, wk) {
  const url =
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}` +
    `?view=mBoxscore&view=mMatchupScore&scoringPeriodId=${wk}`;
  return espnFetch(url, { swid, s2 });
}

// Compact position-appropriate NFL stat line from ESPN's raw stat map.
// Stat ids verified against live boxscore data.
function statLine(pos, st) {
  if (!st) return '';
  const g = (id) => st[id] || 0;
  const rnd = (n) => Math.round(n);
  const parts = [];
  if (pos === 1) { // QB
    if (g(3)) parts.push(`${rnd(g(3))} pass yd`);
    if (g(4)) parts.push(`${g(4)} pass TD`);
    if (g(20)) parts.push(`${g(20)} INT`);
    if (g(24)) parts.push(`${rnd(g(24))} rush yd`);
    if (g(25)) parts.push(`${g(25)} rush TD`);
  } else if (pos === 2) { // RB
    if (g(23)) parts.push(`${g(23)} car`);
    if (g(24) || g(23)) parts.push(`${rnd(g(24))} yd`);
    if (g(25)) parts.push(`${g(25)} TD`);
    if (g(41)) parts.push(`${g(41)} rec, ${rnd(g(42))} yd`);
    if (g(43)) parts.push(`${g(43)} rec TD`);
  } else if (pos === 3 || pos === 4) { // WR / TE
    parts.push(`${g(41)} rec, ${rnd(g(42))} yd`);
    if (g(43)) parts.push(`${g(43)} TD`);
    if (g(24)) parts.push(`${rnd(g(24))} rush yd`);
    if (g(25)) parts.push(`${g(25)} rush TD`);
  } else if (pos === 5) { // K
    if (g(84)) parts.push(`${g(83)}/${g(84)} FG`);
    else if (g(83)) parts.push(`${g(83)} FG`);
    if (g(86)) parts.push(`${g(86)} XP`);
  } else if (pos === 16) { // D/ST
    if (g(99)) parts.push(`${g(99)} sk`);
    if (g(95)) parts.push(`${g(95)} INT`);
    if (g(96)) parts.push(`${g(96)} FR`);
  }
  return parts.join(' · ');
}

function playerLine(entry, wk) {
  const ppe = entry.playerPoolEntry || {};
  const pl = ppe.player || {};
  const actual = (pl.stats || []).find((s) => s.scoringPeriodId === wk && s.statSourceId === 0);
  const pts = round2(actual?.appliedTotal ?? ppe.appliedStatTotal ?? 0);
  return {
    id: entry.playerId, // ESPN player id — join key to draft picks & external NFL data
    n: pl.fullName || `Player ${entry.playerId}`,
    p: POS[pl.defaultPositionId] || '—',
    tm: PRO[pl.proTeamId] ?? '',
    pt: pts,
    l: statLine(pl.defaultPositionId, actual?.stats),
    slot: entry.lineupSlotId,
  };
}

function sideBox(side, teamMeta, wk) {
  const entries = side.rosterForCurrentScoringPeriod?.entries || [];
  const starters = [];
  const bench = [];
  for (const e of entries) {
    const line = playerLine(e, wk);
    if (e.lineupSlotId === BENCH || e.lineupSlotId === IR) {
      bench.push({ id: line.id, n: line.n, p: line.p, tm: line.tm, pt: line.pt, l: line.l, s: e.lineupSlotId === IR ? 'IR' : 'BE' });
    } else {
      starters.push({ id: line.id, n: line.n, p: line.p, tm: line.tm, pt: line.pt, l: line.l, s: SLOT[e.lineupSlotId] || String(e.lineupSlotId) });
    }
  }
  const benchTotal = round2(bench.reduce((a, b) => a + b.pt, 0));
  // per-NFL-week team score (correct even for 2-week playoff matchups)
  const wkScore = side.pointsByScoringPeriod?.[wk];
  const total = wkScore != null ? round2(wkScore) : round2(starters.reduce((a, p) => a + p.pt, 0));
  return {
    teamId: side.teamId,
    ownerId: teamMeta?.ownerId ?? null,
    teamName: teamMeta?.teamName ?? `Team ${side.teamId}`,
    abbrev: teamMeta?.abbrev ?? '',
    total,
    benchTotal,
    starters,
    bench,
  };
}

for (const year of YEARS) {
  const out = path.join(ROOT, 'public', 'data', 'boxscores', `${year}.json`);
  if (!force && fs.existsSync(out)) {
    console.log(`[skip] ${year} (cached)`);
    continue;
  }
  const season = seasonById.get(year);
  const teamMeta = new Map((season?.teams || []).map((t) => [t.teamId, t]));
  const weeks = {};
  let totalGames = 0;
  for (let wk = 1; wk <= 18; wk++) {
    let data;
    try {
      data = await seasonWeek(year, wk);
    } catch (e) {
      console.warn(`  ${year} wk${wk} fetch failed: ${e.message}`);
      continue;
    }
    // Select games whose roster is populated for THIS scoring period (handles
    // 2-week playoff matchups, which surface in each of their two scoring periods).
    const games = (data.schedule || []).filter(
      (g) =>
        g.home?.teamId != null &&
        g.away?.teamId != null &&
        (g.home?.rosterForCurrentScoringPeriod?.entries?.length ||
          g.away?.rosterForCurrentScoringPeriod?.entries?.length) &&
        (g.home?.pointsByScoringPeriod?.[wk] != null || g.away?.pointsByScoringPeriod?.[wk] != null),
    );
    if (!games.length) continue;
    weeks[wk] = games.map((g) => {
      const home = sideBox(g.home, teamMeta.get(g.home.teamId), wk);
      const away = sideBox(g.away, teamMeta.get(g.away.teamId), wk);
      const winner = home.total > away.total ? 'HOME' : away.total > home.total ? 'AWAY' : 'TIE';
      return { mp: g.matchupPeriodId, tier: g.playoffTierType || 'NONE', winner, home, away };
    });
    totalGames += games.length;
  }
  writeJSON(out, { year, weeks });
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`[ok]   ${year}: ${Object.keys(weeks).length} weeks, ${totalGames} games -> ${kb} KB`);
}
console.log('Boxscores done.');
