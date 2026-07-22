// Collect NFL birthdates for every player who ever started for an AFFL team (2018+), from
// ESPN's public core athlete API (unauthenticated, no league credentials needed — different
// host than the fantasy league API). Caches to data/player-bio.json (playerId -> dateOfBirth).
// Usage: node scripts/fetch-player-ages.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJSON, writeJSON } from './lib.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const BOX_SEASONS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const CACHE_PATH = path.join(ROOT, 'data', 'player-bio.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Distinct positive starter player ids across every boxscore year (negative ids are
// synthetic D/ST entries — no individual birthdate applies to them).
const ids = new Set();
for (const year of BOX_SEASONS) {
  const p = path.join(ROOT, 'public', 'data', 'boxscores', `${year}.json`);
  if (!fs.existsSync(p)) continue;
  const box = readJSON(p);
  for (const games of Object.values(box.weeks)) {
    for (const g of games) {
      for (const side of [g.home, g.away]) {
        for (const player of side.starters) {
          if (player.id > 0) ids.add(player.id);
        }
      }
    }
  }
}

const cache = force || !fs.existsSync(CACHE_PATH) ? {} : readJSON(CACHE_PATH);
const todo = [...ids].filter((id) => !(String(id) in cache));
console.log(`${ids.size} distinct starter ids, ${todo.length} to fetch (${ids.size - todo.length} already cached)`);

async function fetchBio(id) {
  const url = `https://sports.core.api.espn.com/v3/sports/football/nfl/athletes/${id}`;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1000 * (i + 1));
        continue;
      }
      if (!res.ok) return null; // not found — no bio for this id
      const data = await res.json();
      return data.dateOfBirth ?? null;
    } catch {
      await sleep(600 * (i + 1));
    }
  }
  return null;
}

const CONCURRENCY = 6;
let done = 0;
async function worker(queue) {
  while (queue.length) {
    const id = queue.pop();
    cache[id] = await fetchBio(id);
    done++;
    if (done % 50 === 0) {
      writeJSON(CACHE_PATH, cache);
      console.log(`  ${done}/${todo.length}`);
    }
  }
}
const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
writeJSON(CACHE_PATH, cache);
console.log(`Done. ${Object.values(cache).filter(Boolean).length}/${Object.keys(cache).length} players have a birthdate.`);
