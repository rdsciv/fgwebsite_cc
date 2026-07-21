import type { ReactNode } from 'react';
import { clsx } from '../lib/util';

export function PageHead({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede?: ReactNode }) {
  return (
    <header className="page-head">
      {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
      <h1 className="page-title">{title}</h1>
      {lede && <p className="page-lede">{lede}</p>}
    </header>
  );
}

export function SectionHead({ title, note, right }: { title: string; note?: string; right?: ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <h2 className="section-title">{title}</h2>
        {note && <div className="section-note">{note}</div>}
      </div>
      {right}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent = 'blue',
  small,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: 'blue' | 'gold' | 'green';
  small?: boolean;
}) {
  return (
    <div className={clsx('stat', accent === 'gold' && 'gold', accent === 'green' && 'green')}>
      <div className="stat-label">{label}</div>
      <div className={clsx('stat-value', small && 'sm')}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('card', className)}>{children}</div>;
}

export function Badge({ kind, children }: { kind?: 'champ' | 'runner' | 'playoff' | 'sacko'; children: ReactNode }) {
  return <span className={clsx('badge', kind)}>{children}</span>;
}

export function TrophyRow({ n }: { n: number }) {
  if (n <= 0) return <span className="muted">—</span>;
  return <span title={`${n} title${n > 1 ? 's' : ''}`}>{'🏆'.repeat(Math.min(n, 5))}</span>;
}
