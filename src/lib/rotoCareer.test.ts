import { describe, expect, it } from 'vitest';
import { buildRotoCareer, type SeasonLoad } from './rotoCareer';
import { fixtureBox, fixtureSeason, game, mkSeason, seasonBox, PACE } from './__fixtures__/box';

const load = (year: number): SeasonLoad => ({ year, season: fixtureSeason(year), box: fixtureBox(year) });
const failed = (year: number): SeasonLoad => ({ year, season: fixtureSeason(year), box: null });

describe('coverage tracking', () => {
  it('marks a season whose boxscore failed to load as missing, not as absent managers', () => {
    const r = buildRotoCareer([load(2023), failed(2024), load(2025)]);

    expect(r.evidence).toBe('Partial');
    expect(r.missingYears).toEqual([2024]);
    expect(r.scoredYears).toEqual([2023, 2025]);
    // Nobody is credited with playing 2024, and nobody is implied to have sat it out either —
    // the year simply is not part of any average.
    for (const row of r.rows) {
      expect(row.seasons).toBe(2);
      expect(row.byYear.has(2024)).toBe(false);
    }
  });

  it('reports Verified only when every expected season loaded', () => {
    const r = buildRotoCareer([load(2023), load(2024), load(2025)]);
    expect(r.evidence).toBe('Verified');
    expect(r.missingYears).toEqual([]);
    expect(r.rows.every((row) => row.seasons === 3)).toBe(true);
  });

  it('reports Unavailable rather than an empty ranking when nothing loaded', () => {
    const r = buildRotoCareer([failed(2024), failed(2025)]);
    expect(r.evidence).toBe('Unavailable');
    expect(r.rows).toEqual([]);
    expect(r.missingYears).toEqual([2024, 2025]);
  });

  it('treats a season with no league metadata as a gap too', () => {
    const r = buildRotoCareer([load(2025), { year: 2024, season: undefined, box: fixtureBox(2024) }]);
    expect(r.missingYears).toEqual([2024]);
    expect(r.evidence).toBe('Partial');
  });

  it('never produces NaN averages', () => {
    const r = buildRotoCareer([load(2024), failed(2025)]);
    for (const row of r.rows) {
      expect(Number.isFinite(row.avgRank)).toBe(true);
      expect(Number.isFinite(row.avgPts)).toBe(true);
    }
  });
});

describe('a manager who did not play is distinct from a missing season', () => {
  it('keeps the year scored while omitting the absent manager', () => {
    // 2024 is a two-team season: only o1 and o2 appear.
    const twoTeam: SeasonLoad = {
      year: 2024,
      season: mkSeason(2024, [1, 2]),
      box: seasonBox(2024, { 1: [game('NONE', [1, PACE[1]], [2, PACE[2]])] }),
    };
    const r = buildRotoCareer([twoTeam, load(2025)]);

    expect(r.evidence).toBe('Verified');
    expect(r.scoredYears).toContain(2024);
    expect(r.missingYears).toEqual([]);

    const o3 = r.rows.find((row) => row.ownerId === 'o3')!;
    expect(o3.seasons).toBe(1); // played 2025 only — genuinely absent, and the year still counted
    expect(o3.byYear.has(2024)).toBe(false);
  });
});

describe('phase selection flows through to the career table', () => {
  it('ranks on regular-season production by default', () => {
    const r = buildRotoCareer([load(2025)]);
    expect(r.rows.map((row) => row.ownerId)).toEqual(['o1', 'o2', 'o3', 'o4']);
  });

  it('changes the ranking when consolation volume is included', () => {
    const r = buildRotoCareer([load(2025)], 'combined', true);
    expect(r.rows[0].ownerId).not.toBe('o1');
  });

  it('records the size of the field each rank was earned in', () => {
    const r = buildRotoCareer([load(2025)], 'post');
    // Only two teams reach the winners bracket, so a rank there is out of 2, not 12.
    for (const row of r.rows) expect(row.byYear.get(2025)!.nTeams).toBe(2);
  });
});
