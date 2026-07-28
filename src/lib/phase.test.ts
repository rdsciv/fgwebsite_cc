import { describe, expect, it } from 'vitest';
import { tierInPhase } from './phase';
import type { PlayoffTier } from '../types';

const TIERS: PlayoffTier[] = ['NONE', 'WINNERS_BRACKET', 'WINNERS_CONSOLATION_LADDER', 'LOSERS_CONSOLATION_LADDER'];

describe('tierInPhase', () => {
  it('excludes consolation from every phase by default', () => {
    for (const phase of ['reg', 'post', 'combined'] as const) {
      expect(tierInPhase('WINNERS_CONSOLATION_LADDER', phase)).toBe(false);
      expect(tierInPhase('LOSERS_CONSOLATION_LADDER', phase)).toBe(false);
    }
  });

  it('partitions combined into reg and post — the invariant the totals rely on', () => {
    for (const tier of TIERS) {
      const inCombined = tierInPhase(tier, 'combined');
      const inReg = tierInPhase(tier, 'reg');
      const inPost = tierInPhase(tier, 'post');
      expect(inReg && inPost).toBe(false); // never both
      expect(inReg || inPost).toBe(inCombined); // exactly one, iff it is in combined
    }
  });

  it('keeps the partition intact when consolation is opted back in', () => {
    for (const tier of TIERS) {
      const inReg = tierInPhase(tier, 'reg', true);
      const inPost = tierInPhase(tier, 'post', true);
      expect(inReg && inPost).toBe(false);
      expect(inReg || inPost).toBe(tierInPhase(tier, 'combined', true));
    }
  });
});
