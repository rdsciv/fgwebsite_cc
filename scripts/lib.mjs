// Shared helpers for the ESPN data pipeline.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RAW_DIR = path.join(ROOT, 'data', 'raw');
export const PLAYERS_DIR = path.join(ROOT, 'data', 'players');

// Minimal .env loader (no dependency).
export function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
  const leagueId = process.env.ESPN_LEAGUE_ID;
  const swid = process.env.ESPN_SWID;
  const s2 = process.env.ESPN_S2;
  if (!leagueId || !swid || !s2) {
    throw new Error('Missing ESPN_LEAGUE_ID / ESPN_SWID / ESPN_S2 (set in .env)');
  }
  return { leagueId, swid, s2 };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function espnFetch(url, { swid, s2, xFilter } = {}, tries = 4) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    Accept: 'application/json',
    Cookie: `SWID=${swid}; espn_s2=${s2}`,
  };
  if (xFilter) headers['x-fantasy-filter'] = JSON.stringify(xFilter);
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1200 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(800 * (i + 1));
    }
  }
  throw lastErr;
}

export function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
export function writeJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data));
}
