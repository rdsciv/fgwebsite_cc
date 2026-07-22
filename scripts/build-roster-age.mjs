// Average starter age + oldest/youngest starters per team, per season (2018+). Reads
// public/data/boxscores/{year}.json (starters) + data/player-bio.json (birthdates, from
// fetch-player-ages.mjs). Writes public/data/roster-age/{year}.json.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJSON, writeJSON } from './lib.mjs';

const BOX_SEASONS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const bioPath = path.join(ROOT, 'data', 'player-bio.json');
const bio = fs.existsSync(bioPath) ? readJSON(bioPath) : {};
const league = readJSON(path.join(ROOT, 'public', 'data', 'league.json'));
const seasonById = new Map(league.seasons.map((s) => [s.year, s]));

function ageAt(dob, refDate) {
  if (!dob) return null;
  const b = new Date(dob);
  const r = new Date(refDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = r.getFullYear() - b.getFullYear();
  const m = r.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && r.getDate() < b.getDate())) age--;
  return age;
}

for (const year of BOX_SEASONS) {
  const boxPath = path.join(ROOT, 'public', 'data', 'boxscores', `${year}.json`);
  if (!fs.existsSync(boxPath)) continue;
  const box = readJSON(boxPath);
  const season = seasonById.get(year);
  const teamMeta = new Map((season?.teams || []).map((t) => [t.teamId, t]));
  const refDate = `${year}-09-01`; // season kickoff reference date

  // distinct starters per team (any player who started at least one week that season)
  const byTeam = new Map(); // teamId -> Map<playerId, {playerId, name, age}>
  for (const games of Object.values(box.weeks)) {
    for (const g of games) {
      for (const side of [g.home, g.away]) {
        if (!byTeam.has(side.teamId)) byTeam.set(side.teamId, new Map());
        const m = byTeam.get(side.teamId);
        for (const p of side.starters) {
          if (p.p === 'D/ST' || m.has(p.id)) continue;
          const age = ageAt(bio[p.id], refDate);
          if (age != null) m.set(p.id, { playerId: p.id, name: p.n, age });
        }
      }
    }
  }

  const teams = [...byTeam.entries()].map(([teamId, players]) => {
    const list = [...players.values()];
    const avgAge = list.length ? list.reduce((a, p) => a + p.age, 0) / list.length : 0;
    const t = teamMeta.get(teamId);
    return {
      teamId,
      ownerId: t?.ownerId ?? null,
      teamName: t?.teamName ?? `Team ${teamId}`,
      avgAge: Math.round(avgAge * 10) / 10,
      oldest: [...list].sort((a, b) => b.age - a.age).slice(0, 4),
      youngest: [...list].sort((a, b) => a.age - b.age).slice(0, 4),
    };
  });

  writeJSON(path.join(ROOT, 'public', 'data', 'roster-age', `${year}.json`), { year, teams });
  console.log(`[ok] roster-age ${year}: ${teams.length} teams`);
}
console.log('Roster age done.');
