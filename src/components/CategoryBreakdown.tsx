import type { CatKey, TeamCategoryStats } from '../lib/categoryStats';
import { clsx, fmt, fmt0 } from '../lib/util';

export const GROUP_COLOR: Record<string, string> = { Passing: 'var(--s1)', Rushing: 'var(--gold)', Receiving: 'var(--s7)' };

function formatValue(key: CatKey, value: number) {
  if (key === 'compPct') return `${fmt(value, 1)}%`;
  if (key === 'ypc' || key === 'ypr') return fmt(value, 2);
  return fmt0(value);
}

export function CategoryBreakdownTable({ team, nTeams }: { team: TeamCategoryStats; nTeams: number }) {
  let lastGroup = '';
  return (
    <div className="cb-table">
      <div className="cb-head">
        <span>Category</span>
        <span>Stat</span>
        <span style={{ textAlign: 'right' }}>Value</span>
        <span style={{ textAlign: 'right' }}>Rank</span>
        <span style={{ textAlign: 'right' }}>Pts</span>
        <span>Strength</span>
      </div>
      {team.categories.map((c) => {
        const showGroup = c.group !== lastGroup;
        lastGroup = c.group;
        return (
          <div className="cb-row" key={c.key} style={{ borderLeftColor: showGroup ? GROUP_COLOR[c.group] : 'transparent' }}>
            <span className="cb-group" style={{ color: GROUP_COLOR[c.group] }}>{showGroup ? c.group.toUpperCase() : ''}</span>
            <span>{c.label}</span>
            <span className="tnum" style={{ textAlign: 'right' }}>{formatValue(c.key, c.value)}</span>
            <span className="tnum" style={{ textAlign: 'right', color: c.rank === 1 ? 'var(--win)' : c.rank === nTeams ? 'var(--loss)' : 'var(--ink)' }}>
              #{c.rank}/{nTeams}
            </span>
            <span className="tnum" style={{ textAlign: 'right', color: 'var(--gold-2)', fontWeight: 700 }}>{c.pts}</span>
            <span className="cb-pips">
              {Array.from({ length: nTeams }, (_, i) => (
                <span key={i} className={clsx('cb-pip', i < c.pts && 'filled')} style={i < c.pts ? { background: GROUP_COLOR[c.group] } : undefined} />
              ))}
            </span>
          </div>
        );
      })}
      <div className="cb-row cb-total">
        <span />
        <span style={{ fontWeight: 700 }}>TOTAL</span>
        <span />
        <span className="tnum" style={{ textAlign: 'right', fontWeight: 700 }}>#{team.totalRank}/{nTeams}</span>
        <span className="tnum" style={{ textAlign: 'right', color: 'var(--gold-2)', fontWeight: 700, fontSize: 16 }}>{team.totalPts}</span>
        <span />
      </div>
    </div>
  );
}
