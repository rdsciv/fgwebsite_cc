import { describe, expect, it } from 'vitest';
import { computeCategoryStats, type CatKey, type TeamCategoryStats } from './categoryStats';
import { fixtureBox, fixtureSeason, PACE } from './__fixtures__/box';

const box = fixtureBox();
const season = fixtureSeason();

const byTeam = (rows: TeamCategoryStats[]) => new Map(rows.map((r) => [r.teamId, r]));
const val = (rows: TeamCategoryStats[], teamId: number, key: CatKey) =>
  byTeam(rows).get(teamId)?.categories.find((c) => c.key === key)?.value ?? 0;

// Counting categories only — rates (compPct/ypc/ypr) are ratios and do not add across phases.
const COUNTING: CatKey[] = ['py', 'ptd', 'ry', 'rtd', 'recy', 'retd', 'rec'];

describe('phase filtering', () => {
  it('regular season gives every team the same number of games', () => {
    const rows = computeCategoryStats(box, season, 'reg');
    expect(rows.map((r) => r.games)).toEqual([2, 2, 2, 2]);
  });

  it('excludes consolation games by default', () => {
    const rows = computeCategoryStats(box, season, 'combined');
    // T3 and T4 played two consolation games each; without them they are left at their two
    // regular-season games while T1/T2 also have their winners-bracket game.
    expect(byTeam(rows).get(3)!.games).toBe(2);
    expect(byTeam(rows).get(4)!.games).toBe(2);
    expect(byTeam(rows).get(1)!.games).toBe(3);
  });

  it('includes consolation games when explicitly asked', () => {
    const rows = computeCategoryStats(box, season, 'combined', true);
    expect(byTeam(rows).get(3)!.games).toBe(4);
    expect(byTeam(rows).get(4)!.games).toBe(4);
  });

  it('postseason covers only teams with winners-bracket games', () => {
    const rows = computeCategoryStats(box, season, 'post');
    expect(rows.map((r) => r.teamId).sort()).toEqual([1, 2]);
    expect(rows.every((r) => r.games === 1)).toBe(true);
  });
});

describe('consolation contamination (regression)', () => {
  it('does not let consolation volume outrank regular-season production', () => {
    const clean = computeCategoryStats(box, season, 'combined');
    expect(clean.map((r) => r.teamId)).toEqual([1, 2, 3, 4]);
  });

  it('demonstrates the bias the default guards against', () => {
    // With consolation counted, T3 accumulates 4 games of volume against T1's 3 and takes the top
    // spot in every counting category despite the third-best per-game production.
    const dirty = computeCategoryStats(box, season, 'combined', true);
    expect(val(dirty, 3, 'recy')).toBe(PACE[3] * 4);
    expect(val(dirty, 1, 'recy')).toBe(PACE[1] * 3);
    expect(val(dirty, 3, 'recy')).toBeGreaterThan(val(dirty, 1, 'recy'));
    // ...and the leader of the clean table is no longer the leader.
    expect(dirty[0].teamId).not.toBe(1);
  });
});

describe('phase invariants (ENGINEERING_SPEC §9.5)', () => {
  it('reg + post equals combined for every counting category', () => {
    const reg = computeCategoryStats(box, season, 'reg');
    const post = computeCategoryStats(box, season, 'post');
    const combined = computeCategoryStats(box, season, 'combined');

    for (const teamId of [1, 2, 3, 4]) {
      for (const key of COUNTING) {
        expect(val(reg, teamId, key) + val(post, teamId, key)).toBe(val(combined, teamId, key));
      }
      const games = (rows: TeamCategoryStats[]) => byTeam(rows).get(teamId)?.games ?? 0;
      expect(games(reg) + games(post)).toBe(games(combined));
    }
  });
});

describe('empty inputs', () => {
  it('returns no rows rather than NaN when a phase has no games', () => {
    const noPlayoffs = fixtureBox();
    delete noPlayoffs.weeks[3];
    delete noPlayoffs.weeks[4];
    const rows = computeCategoryStats(noPlayoffs, season, 'post');
    expect(rows).toEqual([]);
  });

  it('never emits NaN for a rate category', () => {
    const rows = computeCategoryStats(box, season, 'combined');
    for (const r of rows) for (const c of r.categories) expect(Number.isFinite(c.value)).toBe(true);
  });
});
