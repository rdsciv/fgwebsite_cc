import { useEffect, useMemo, useState } from 'react';
import { useLeague } from '../data';
import { PageHead, Card } from '../components/bits';
import { OwnerChip } from '../components/OwnerChip';
import { loadBoxscore, hasBoxscores } from '../lib/boxscores';
import { clsx, fmt, posColor, tierLabel } from '../lib/util';
import type { BoxGame, BoxPlayer, BoxSide, SeasonBox } from '../types';

// Canonical starting-lineup order: QB, RB, RB, WR, WR, TE, FLEX, D/ST, K.
const SLOT_ORDER: Record<string, number> = {
  QB: 1, RB: 2, 'RB/WR': 2.5, WR: 3, 'WR/TE': 3.5, TE: 4, OP: 4.5, FLEX: 5, 'D/ST': 6, K: 7,
};
const slotRank = (s: string) => SLOT_ORDER[s] ?? 5.5;

export function Scoreboard() {
  const { league, ownerName } = useLeague();
  const seasons = league.meta.seasons;
  const [year, setYear] = useState(league.meta.lastSeason);
  const [box, setBox] = useState<SeasonBox | null>(null);
  const [loading, setLoading] = useState(false);
  const [week, setWeek] = useState<number>(1);

  // load the season's boxscore file when the year changes
  useEffect(() => {
    let alive = true;
    if (hasBoxscores(year)) {
      setLoading(true);
      loadBoxscore(year).then((b) => {
        if (!alive) return;
        setBox(b);
        setLoading(false);
      });
    } else {
      setBox(null);
    }
    return () => {
      alive = false;
    };
  }, [year]);

  // available weeks (from boxscores when present, else from the season schedule)
  const season = league.seasons.find((s) => s.year === year);
  const weeks = useMemo(() => {
    if (hasBoxscores(year)) {
      if (!box) return [];
      return Object.keys(box.weeks)
        .map(Number)
        .sort((a, b) => a - b)
        .map((wk) => ({ wk, playoff: box.weeks[wk].some((g) => g.tier !== 'NONE') }));
    }
    const mps = [...new Set((season?.matchups ?? []).map((m) => m.mp))].sort((a, b) => a - b);
    return mps.map((wk) => ({ wk, playoff: (season?.matchups ?? []).some((m) => m.mp === wk && m.tier !== 'NONE') }));
  }, [box, season, year]);

  // keep the selected week valid whenever the week list changes
  useEffect(() => {
    if (weeks.length && !weeks.some((w) => w.wk === week)) setWeek(weeks[0].wk);
  }, [weeks]); // eslint-disable-line react-hooks/exhaustive-deps

  const boxGames: BoxGame[] = box?.weeks[week] ?? [];
  const fallbackGames = !hasBoxscores(year) ? (season?.matchups ?? []).filter((m) => m.mp === week) : [];

  return (
    <div className="page">
      <PageHead
        eyebrow="Every Week, Every Team"
        title="Weekly Scoreboards"
        lede={
          <>
            Full box scores for all {league.meta.nSeasons} seasons — every matchup, every starter and
            bench player, and what they scored. Player-level detail is available from {2018} on.
          </>
        }
      />

      {/* season selector */}
      <div className="year-strip" style={{ marginBottom: 14 }}>
        {seasons.map((y) => (
          <button key={y} className={clsx('year-btn', y === year && 'active')} onClick={() => setYear(y)}>
            {y}
          </button>
        ))}
      </div>

      {/* week selector */}
      <div className="week-nav">
        <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Week</span>
        {weeks.map(({ wk, playoff }) => (
          <button
            key={wk}
            className={clsx('wk-btn', playoff && 'playoff', wk === week && 'active')}
            onClick={() => setWeek(wk)}
            title={playoff ? 'Playoffs' : undefined}
          >
            {wk}
          </button>
        ))}
      </div>

      {loading && <div className="empty">Loading {year} box scores…</div>}

      {!loading && hasBoxscores(year) && (
        <div className="box-grid" style={{ marginTop: 16 }}>
          {boxGames.map((g, i) => (
            <MatchupBox key={i} game={g} ownerName={ownerName} />
          ))}
          {!boxGames.length && <div className="empty">No games this week.</div>}
        </div>
      )}

      {!loading && !hasBoxscores(year) && (
        <>
          <Card className="card-pad">
            <div className="muted" style={{ fontSize: 13 }}>
              ⓘ ESPN doesn't expose player-level rosters for {year} (only 2018 onward). Team scores are shown below.
            </div>
          </Card>
          <div className="box-grid" style={{ marginTop: 16 }}>
            {fallbackGames.map((m, i) => {
              const homeWin = m.winner === 'HOME';
              const awayWin = m.winner === 'AWAY';
              return (
                <Card key={i}>
                  <div className="box-head">
                    <div className={clsx('box-team', homeWin && 'win')}>
                      <div className="box-team-name">
                        {season?.teams.find((t) => t.ownerId === m.home.ownerId)?.teamName ?? ownerName(m.home.ownerId)}
                      </div>
                      <div className="box-team-total">{fmt(m.home.score, 1)}</div>
                    </div>
                    <div className="box-vs">{tierLabel(m.tier)}</div>
                    <div className={clsx('box-team', 'away', awayWin && 'win')}>
                      <div className="box-team-name">
                        {season?.teams.find((t) => t.ownerId === m.away.ownerId)?.teamName ?? ownerName(m.away.ownerId)}
                      </div>
                      <div className="box-team-total">{fmt(m.away.score, 1)}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
            {!fallbackGames.length && <div className="empty">No games this week.</div>}
          </div>
        </>
      )}
    </div>
  );
}

function MatchupBox({ game, ownerName }: { game: BoxGame; ownerName: (id: string) => string }) {
  const { home, away, winner, tier } = game;
  return (
    <div className="box-card">
      <div className="box-head">
        <TeamHead side={home} win={winner === 'HOME'} ownerName={ownerName} align="left" />
        <div style={{ textAlign: 'center' }}>
          <div className="box-vs">vs</div>
          {tier !== 'NONE' && <div className="box-tier">{tierLabel(tier)}</div>}
        </div>
        <TeamHead side={away} win={winner === 'AWAY'} ownerName={ownerName} align="right" />
      </div>
      <div className="box-body">
        <Lineup side={home} />
        <Lineup side={away} />
      </div>
    </div>
  );
}

function TeamHead({
  side,
  win,
  ownerName,
  align,
}: {
  side: BoxSide;
  win: boolean;
  ownerName: (id: string) => string;
  align: 'left' | 'right';
}) {
  return (
    <div className={clsx('box-team', align === 'right' && 'away', win && 'win')}>
      <div className="box-team-name">{side.teamName}</div>
      <div style={{ display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', margin: '2px 0' }}>
        {side.ownerId ? (
          <OwnerChip id={side.ownerId} name={ownerName(side.ownerId)} size={18} />
        ) : (
          <span className="owner-team">—</span>
        )}
      </div>
      <div className="box-team-total">{fmt(side.total, 1)}</div>
    </div>
  );
}

function Lineup({ side }: { side: BoxSide }) {
  const starters = [...side.starters].sort((a, b) => slotRank(a.s) - slotRank(b.s));
  return (
    <div className="box-lineup">
      <div className="box-sec">Starters</div>
      {starters.map((p, i) => (
        <PlayerRow key={i} p={p} />
      ))}
      <div className="box-subtotal">
        <span>Starters</span>
        <span className="v">{fmt(side.total, 1)}</span>
      </div>
      <div className="box-sec">Bench</div>
      {side.bench.map((p, i) => (
        <PlayerRow key={i} p={p} bench />
      ))}
      <div className="box-subtotal">
        <span>Bench</span>
        <span className="v">{fmt(side.benchTotal, 1)}</span>
      </div>
    </div>
  );
}

function PlayerRow({ p, bench }: { p: BoxPlayer; bench?: boolean }) {
  return (
    <div className={clsx('box-row', bench && 'bench')}>
      <span
        className={clsx('slot-chip', bench && 'be')}
        style={bench ? undefined : { background: posColor(p.p) }}
      >
        {p.s}
      </span>
      <span style={{ minWidth: 0 }}>
        <div className="box-pl-name">{p.n}</div>
        <div className="box-pl-meta">
          {p.p}{p.tm ? ` · ${p.tm}` : ''}{p.l ? <span className="box-pl-stat"> · {p.l}</span> : ''}
        </div>
      </span>
      <span className="box-pl-pts">{fmt(p.pt, 1)}</span>
    </div>
  );
}
