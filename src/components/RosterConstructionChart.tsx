import type { RosterConstructionYear } from '../lib/rosterConstruction';
import { posColor, fmt0 } from '../lib/util';

function lastName(full: string) {
  const parts = full.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export function RosterConstructionChart({ years }: { years: RosterConstructionYear[] }) {
  if (!years.length) return null;
  return (
    <div className="rc-chart">
      {years.map((y) => {
        const starterSpend = y.players.slice(0, y.starterCount).reduce((a, p) => a + p.bid, 0);
        const dividerPct = y.totalSpend > 0 ? (starterSpend / y.totalSpend) * 100 : 0;
        return (
          <div className="rc-row" key={y.year}>
            <div className="rc-year">{y.year}</div>
            <div className="rc-bar">
              {y.players.map((p) => {
                const w = y.totalSpend > 0 ? (p.bid / y.totalSpend) * 100 : 0;
                return (
                  <div
                    key={p.playerId}
                    className="rc-seg"
                    style={{ width: `${w}%`, background: posColor(p.pos), opacity: p.isStarter ? 1 : 0.42 }}
                    title={`${p.playerName} (${p.pos}) · $${p.bid}${p.isStarter ? '' : ' · bench'}`}
                  >
                    {w > 6 && <span className="rc-label">{lastName(p.playerName)} ${p.bid}</span>}
                  </div>
                );
              })}
              {y.starterCount > 0 && y.starterCount < y.players.length && (
                <div className="rc-divider" style={{ left: `${dividerPct}%` }} />
              )}
            </div>
            <div className="rc-total">${fmt0(y.totalSpend)}</div>
          </div>
        );
      })}
    </div>
  );
}
