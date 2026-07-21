// Pull executed roster-acquisition transactions (waiver / free-agent / trade adds) per
// season and reduce them to compact acquisition events keyed by player + team + week.
// Roster Lab uses these (plus the draft) to bin each player's points by how he was acquired.
// Usage: node scripts/build-transactions.mjs [--force] [year...]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadEnv, espnFetch, writeJSON } from './lib.mjs';

const { leagueId, swid, s2 } = loadEnv();
const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyYears = args.filter((a) => /^\d{4}$/.test(a)).map(Number);

// Transactions are exposed per scoring period from 2018 on (same cutoff as boxscores).
const TX_SEASONS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const YEARS = onlyYears.length ? onlyYears.filter((y) => TX_SEASONS.includes(y)) : TX_SEASONS;

async function fetchWeek(year, sp) {
  const url =
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}` +
    `?view=mTransactions2&scoringPeriodId=${sp}`;
  try {
    return await espnFetch(url, { swid, s2 });
  } catch {
    return { transactions: [] };
  }
}

for (const year of YEARS) {
  const out = path.join(ROOT, 'public', 'data', 'transactions', `${year}.json`);
  if (!force && fs.existsSync(out)) {
    console.log(`[skip] ${year} (cached)`);
    continue;
  }

  // Gather every transaction once (dedupe by id across per-week queries).
  const byId = new Map();
  for (let sp = 0; sp <= 18; sp++) {
    const d = await fetchWeek(year, sp);
    for (const t of d.transactions || []) byId.set(t.id, t);
  }

  // Reduce to acquisition ADD events: player -> team, method, week.
  const seen = new Set();
  const events = [];
  const push = (pid, team, m, sp) => {
    const k = `${pid}|${team}|${m}|${sp}`;
    if (seen.has(k)) return;
    seen.add(k);
    events.push({ pid, team, m, sp });
  };
  const counts = { W: 0, F: 0, T: 0 };
  for (const t of byId.values()) {
    if (t.status && t.status !== 'EXECUTED') continue;
    const sp = t.scoringPeriodId ?? 0;
    if (t.type === 'WAIVER' || t.type === 'FREEAGENT') {
      const m = t.type === 'WAIVER' ? 'W' : 'F';
      for (const i of t.items || []) {
        if (i.type === 'ADD' && i.toTeamId > 0) {
          push(i.playerId, i.toTeamId, m, sp);
          counts[m]++;
        }
      }
    } else if (t.type === 'TRADE_ACCEPT') {
      for (const i of t.items || []) {
        if (i.toTeamId > 0 && i.fromTeamId > 0) {
          push(i.playerId, i.toTeamId, 'T', sp);
          counts.T++;
        }
      }
    }
  }

  events.sort((a, b) => a.sp - b.sp);
  writeJSON(out, { year, events });
  console.log(`[ok]   ${year}: ${events.length} acquisition events (waiver ${counts.W}, FA ${counts.F}, trade ${counts.T})`);
}
console.log('Transactions done.');
