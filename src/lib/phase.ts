// Phase plumbing (ENGINEERING_SPEC §5): every aggregate is computable per phase.
//
// Consolation is excluded by DEFAULT from every phase, not just Combined. That is what keeps the
// spec's invariant honest — `reg + post == combined` only holds if reg and post actually partition
// combined, so the same consolation rule has to apply to all three.
import type { PlayoffTier } from '../types';

export type Phase = 'reg' | 'post' | 'combined';

export const PHASE_LABEL: Record<Phase, string> = {
  reg: 'Regular',
  post: 'Postseason',
  combined: 'Combined',
};

const isConsolation = (tier: PlayoffTier) =>
  tier === 'WINNERS_CONSOLATION_LADDER' || tier === 'LOSERS_CONSOLATION_LADDER';

/** Does a game of this tier belong to `phase`? */
export function tierInPhase(tier: PlayoffTier, phase: Phase, includeConsolation = false): boolean {
  if (isConsolation(tier) && !includeConsolation) return false;
  if (phase === 'combined') return true;
  return phase === 'reg' ? tier === 'NONE' : tier !== 'NONE';
}
