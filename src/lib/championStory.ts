import type { Season } from '../types';
import { fmt0, ordinal, pct } from './util';

/** One-liner on what elevated a title team that year (draft / power / luck / roto-ish season traits). */
export function championElevation(
  season: Season | undefined,
  ownerId: string | undefined,
): string {
  if (!season || !ownerId) return 'Title clinched.';
  const team = season.teams.find((t) => t.ownerId === ownerId);
  if (!team) return 'Title clinched.';

  const bits: string[] = [];

  // Draft story — biggest non-keeper auction hit that season
  const picks = season.draft.picks.filter((p) => p.ownerId === ownerId && !p.keeper);
  const bestBid = [...picks].sort((a, b) => b.bid - a.bid || (b.roundPick - a.roundPick))[0];
  if (bestBid && bestBid.bid > 0) {
    bits.push(`Best draft hit: $${bestBid.bid} on ${bestBid.playerName} (${bestBid.pos})`);
  } else if (bestBid) {
    bits.push(`Key pick: ${bestBid.playerName} (${bestBid.pos})`);
  }

  // Power / schedule strength proxies already on SeasonTeam
  if (team.powerPct >= 0.65) {
    bits.push(`${pct(team.powerPct)} all-play — field-beating roster`);
  } else if (team.regPowerPct >= 0.62) {
    bits.push(`${pct(team.regPowerPct)} regular-season all-play`);
  }

  if (team.regRank === 1) {
    bits.push('Regular-season #1 seed');
  } else if (team.regRank != null && team.regRank <= 3) {
    bits.push(`${ordinal(team.regRank)} in the regular season`);
  }

  // Luck story
  if (team.netLuck <= -2) {
    bits.push('Won it despite bad luck (unlucky losses)');
  } else if (team.netLuck >= 3) {
    bits.push('Timely luck on close weeks');
  }

  // Scoring weight
  if (team.pf > 0 && team.regRank != null) {
    const pfRank =
      [...season.teams].sort((a, b) => b.pf - a.pf).findIndex((t) => t.ownerId === ownerId) + 1;
    if (pfRank === 1) bits.push(`League-high ${fmt0(team.pf)} PF`);
    else if (pfRank <= 3) bits.push(`${ordinal(pfRank)} in total points (${fmt0(team.pf)} PF)`);
  }

  // Exceptional power / efficiency angles
  if (team.luckyWins >= 3) bits.push(`${team.luckyWins} gritty bottom-half wins`);
  if (team.unluckyLosses >= 3) bits.push(`Survived ${team.unluckyLosses} tough top-half losses`);

  if (bits.length === 0) {
    return `${recordLine(team.wins, team.losses, team.ties)} · ${fmt0(team.pf)} PF · title run.`;
  }

  // Prefer 1–2 sharp bullets joined
  return bits.slice(0, 2).join(' · ');
}

function recordLine(w: number, l: number, t: number): string {
  return t ? `${w}-${l}-${t}` : `${w}-${l}`;
}
