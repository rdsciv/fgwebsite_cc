import type { PlayoffTier } from '../types';

export const fmt = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmt0 = (n: number) => Math.round(n).toLocaleString('en-US');
export const pct = (n: number) => (n * 100).toFixed(1) + '%';

export function recordStr(w: number, l: number, t: number) {
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

export function ordinal(n: number | null | undefined) {
  if (n == null) return '—';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic decorative avatar color from an owner id (identity is always
// carried by the name beside it, so this is not a CVD-gated chart channel).
const AVATAR_COLORS = [
  '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9',
  '#e66767', '#2fa02f', '#38b2c4', '#c06fd8', '#e0913a', '#4f9d6b',
  '#7c8ce0', '#d76b8f', '#57a9e0', '#b9a13a',
];
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
export function avatarColor(id: string) {
  return AVATAR_COLORS[hash(id) % AVATAR_COLORS.length];
}

export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

export function tierLabel(t: PlayoffTier): string {
  switch (t) {
    case 'WINNERS_BRACKET': return 'Playoffs';
    case 'WINNERS_CONSOLATION_LADDER': return 'Consolation';
    case 'LOSERS_CONSOLATION_LADDER': return 'Toilet Bowl';
    default: return 'Regular';
  }
}

const POS_COLORS: Record<string, string> = {
  QB: '#d55181', RB: '#199e70', WR: '#3987e5', TE: '#c98500',
  'D/ST': '#9085e9', K: '#d95926',
};
export const posColor = (pos: string) => POS_COLORS[pos] || 'var(--ink-3)';

export function clsx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

// Least-squares linear regression, for a scatter's trend line.
export function linreg(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}
