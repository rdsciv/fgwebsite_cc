// Pull all historical ESPN league data + player-name maps into data/raw and data/players.
// Usage: node scripts/fetch-espn.mjs [--force] [startYear] [endYear]
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, espnFetch, RAW_DIR, PLAYERS_DIR } from './lib.mjs';

const { leagueId, swid, s2 } = loadEnv();
const args = process.argv.slice(2);
const force = args.includes('--force');
const years = args.filter((a) => /^\d{4}$/.test(a)).map(Number);
const START = years[0] ?? 2014;
const END = years[1] ?? 2025;

const VIEWS = ['mTeam', 'mMatchupScore', 'mSettings', 'mDraftDetail', 'mStatus', 'mStandings'];
const HIST = (year) =>
  `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/${leagueId}?seasonId=${year}&` +
  VIEWS.map((v) => `view=${v}`).join('&');

async function fetchSeason(year) {
  const out = path.join(RAW_DIR, `${year}.json`);
  if (!force && fs.existsSync(out)) {
    console.log(`  [skip] ${year} (cached)`);
  } else {
    const data = await espnFetch(HIST(year), { swid, s2 });
    const league = Array.isArray(data) ? data[0] : data;
    if (!league || !league.teams) throw new Error(`No team data for ${year}`);
    fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.writeFileSync(out, JSON.stringify(league));
    console.log(`  [ok]   ${year}: ${league.teams.length} teams, ${league.schedule?.length ?? 0} games, ${league.draftDetail?.picks?.length ?? 0} picks`);
  }
  await fetchPlayers(year);
}

async function fetchPlayers(year) {
  const out = path.join(PLAYERS_DIR, `${year}.json`);
  if (!force && fs.existsSync(out)) {
    console.log(`         players ${year} cached`);
    return;
  }
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/players?scoringPeriodId=0&view=players_wl`;
  try {
    const list = await espnFetch(url, { swid, s2, xFilter: { filterActive: null } });
    const map = {};
    for (const p of list) {
      if (p && p.id != null) map[p.id] = { name: p.fullName, pos: p.defaultPositionId };
    }
    fs.mkdirSync(PLAYERS_DIR, { recursive: true });
    fs.writeFileSync(out, JSON.stringify(map));
    console.log(`         players ${year}: ${Object.keys(map).length}`);
  } catch (e) {
    console.warn(`         players ${year} FAILED: ${e.message} (draft names will fall back to id)`);
    fs.mkdirSync(PLAYERS_DIR, { recursive: true });
    fs.writeFileSync(out, JSON.stringify({}));
  }
}

console.log(`Fetching AFFL league ${leagueId}, seasons ${START}-${END}${force ? ' (force)' : ''}`);
for (let y = START; y <= END; y++) {
  await fetchSeason(y);
}
console.log('Done.');
