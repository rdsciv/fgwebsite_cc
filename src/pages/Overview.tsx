import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useLeague } from '../data';
import { SectionHead, StatTile, Card } from '../components/bits';
import { OwnerChip } from '../components/OwnerChip';
import { fmt0, ordinal, pct, recordStr } from '../lib/util';
import { championElevation } from '../lib/championStory';
import { hasBoxscores, loadBoxscore } from '../lib/boxscores';
import { computeTeamPotential } from '../lib/idealLineup';
import type { Owner } from '../types';

export function Overview() {
  const { league, ownerName, teamLabel, seasonByYear, visibleOwners } = useLeague();
  const { meta, championsTimeline, records } = league;
  const owners = visibleOwners;

  const totalGames = league.seasons.reduce((a, s) => a + s.matchups.length, 0);
  const totalPoints = league.seasons.reduce((a, s) => a + s.teams.reduce((b, t) => b + t.pf, 0), 0);

  const reign = championsTimeline[championsTimeline.length - 1];
  const reignSeason = seasonByYear.get(reign.year);
  const reignTeam = reignSeason?.teams.find((t) => t.finalRank === 1);
  const reignTeamName = reign.champion
    ? teamLabel(reign.champion.ownerId, reign.year) || reign.champion.teamName
    : '—';
  const reignBlurb = championElevation(reignSeason, reign.champion?.ownerId);

  const mostTitles = [...owners]
    .sort((a, b) => b.allTime.championships - a.allTime.championships || b.allTime.wins - a.allTime.wins)
    .slice(0, 5);
  const bestPct = [...owners]
    .filter((o) => o.allTime.gamesPlayed >= 40)
    .sort((a, b) => b.allTime.pct - a.allTime.pct)
    .slice(0, 5);
  const mostPoints = [...owners].sort((a, b) => b.allTime.pf - a.allTime.pf).slice(0, 5);

  // All-time Maximum Potential (sum of ideal lineup pts across seasons with boxscores)
  const [maxPotentialRows, setMaxPotentialRows] = useState<{ id: string; name: string; val: string }[]>([]);
  useEffect(() => {
    let alive = true;
    const years = league.meta.seasons.filter(hasBoxscores);
    Promise.all(
      years.map(async (y) => {
        const season = league.seasons.find((s) => s.year === y);
        if (!season) return [] as { ownerId: string; ideal: number }[];
        const box = await loadBoxscore(y);
        if (!box) return [];
        return computeTeamPotential(box, season).map((t) => ({ ownerId: t.ownerId, ideal: t.idealPts }));
      }),
    ).then((chunks) => {
      if (!alive) return;
      const sum = new Map<string, number>();
      for (const rows of chunks) {
        for (const r of rows) {
          if (!r.ownerId) continue;
          sum.set(r.ownerId, (sum.get(r.ownerId) ?? 0) + r.ideal);
        }
      }
      const ranked = [...sum.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, ideal]) => ({
          id,
          name: ownerName(id),
          val: fmt0(ideal),
        }));
      setMaxPotentialRows(ranked);
    });
    return () => {
      alive = false;
    };
  }, [league, ownerName]);

  const hall = useMemo(() => [...championsTimeline].reverse(), [championsTimeline]);

  return (
    <div className="page">
      {/* the first screen leads with the standing answer to "who's on top", not the league name */}
      <div className="section section-lead">
        <div className="reign-card card">
          <div className="reign-glow" />
          <div className="reign-body">
            <div className="reign-tag">🏆 Reigning Champion · {reign.year}</div>
            <div className="reign-name">{reignTeamName}</div>
            {reignTeam && (
              <div className="reign-meta">
                <span className="pill">{recordStr(reignTeam.wins, reignTeam.losses, reignTeam.ties)}</span>
                <span className="pill">{fmt0(reignTeam.pf)} PF</span>
                <span className="pill">{ordinal(reignTeam.regRank)} in regular season</span>
              </div>
            )}
            <p className="reign-blurb">{reignBlurb}</p>
            {reign.champion && (
              <Link
                to={`/owners/${encodeURIComponent(reign.champion.ownerId)}`}
                className="link-arrow"
                style={{ marginTop: 12, display: 'inline-block' }}
              >
                Franchise page →
              </Link>
            )}
          </div>
          {/* league totals ride in the band's right half — it was empty space otherwise */}
          <dl className="reign-facts">
            <div>
              <dt>Seasons</dt>
              <dd>{meta.nSeasons}</dd>
              <span>{meta.firstSeason}–{meta.lastSeason}</span>
            </div>
            <div>
              <dt>Games Played</dt>
              <dd>{fmt0(totalGames)}</dd>
              <span>regular season + playoffs</span>
            </div>
            <div>
              <dt>Points Scored</dt>
              <dd>{fmt0(totalPoints)}</dd>
              <span>across {meta.nSeasons} seasons</span>
            </div>
          </dl>
        </div>
      </div>

      {/* hall of champions — full grid, no horizontal scroll; elevation blurb not generic trophy */}
      <div className="section">
        <SectionHead
          title="Hall of Champions"
          note="What elevated each title team"
          right={
            <Link to="/seasons" className="link-arrow">
              Browse seasons →
            </Link>
          }
        />
        <div className="champ-grid">
          {hall.map((c) => {
            const season = seasonByYear.get(c.year);
            const name = c.champion ? teamLabel(c.champion.ownerId, c.year) || c.champion.teamName : '—';
            const blurb = championElevation(season, c.champion?.ownerId);
            return (
              <Link key={c.year} to={`/seasons/${c.year}`} className="champ-cell">
                <div className="champ-cell-top">
                  <div className="yr">{c.year}</div>
                </div>
                <div className="cn">{name}</div>
                <div className="cb">{blurb}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* leaderboards */}
      <div className="section">
        <SectionHead
          title="All-Time Leaders"
          right={
            <Link to="/standings" className="link-arrow">
              Full standings →
            </Link>
          }
        />
        <div className="grid cols-2 leaders-grid">
          <Leaderboard
            title="Most Championships"
            rows={mostTitles.map((o) => ({
              id: o.id,
              name: ownerName(o.id),
              val: o.allTime.championships === 0 ? '—' : '🏆'.repeat(Math.min(o.allTime.championships, 5)),
            }))}
          />
          <Leaderboard
            title="Best Win %"
            note="min. 40 games"
            rows={bestPct.map((o) => ({ id: o.id, name: ownerName(o.id), val: pct(o.allTime.pct) }))}
          />
          <Leaderboard
            title="Most Points Scored"
            rows={mostPoints.map((o) => ({ id: o.id, name: ownerName(o.id), val: fmt0(o.allTime.pf) }))}
          />
          <Leaderboard
            title="Most Maximum Potential"
            note="sum of ideal lineup pts (boxscore eras)"
            rows={
              maxPotentialRows.length
                ? maxPotentialRows
                : placeholderPotential(owners, ownerName)
            }
          />
        </div>
      </div>

      {/* single-game superlatives */}
      <div className="section">
        <SectionHead
          title="Signature Moments"
          right={
            <Link to="/records" className="link-arrow">
              Record book →
            </Link>
          }
        />
        <div className="grid cols-3">
          <Card className="card-pad">
            <div className="stat-label">Highest Single Week</div>
            <div className="record-val" style={{ fontSize: 30, marginTop: 6 }}>
              {records.singleHigh.score.toFixed(2)}
            </div>
            <div className="record-sub">
              {records.singleHigh.owner} · {records.singleHigh.year} Wk {records.singleHigh.week}
            </div>
          </Card>
          <Card className="card-pad">
            <div className="stat-label">Biggest Blowout</div>
            <div className="record-val" style={{ fontSize: 30, marginTop: 6 }}>
              +{records.biggestBlowout.margin.toFixed(2)}
            </div>
            <div className="record-sub">
              {records.biggestBlowout.winner} def. {records.biggestBlowout.loser} · {records.biggestBlowout.year}
            </div>
          </Card>
          <Card className="card-pad">
            <div className="stat-label">Biggest Auction Bid</div>
            <div className="record-val" style={{ fontSize: 30, marginTop: 6 }}>
              ${records.biggestBids[0]?.bid}
            </div>
            <div className="record-sub">
              {records.biggestBids[0]?.player} · {records.biggestBids[0]?.owner} · {records.biggestBids[0]?.year}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function placeholderPotential(owners: Owner[], ownerName: (id: string) => string) {
  return [...owners]
    .sort((a, b) => b.allTime.pf - a.allTime.pf)
    .slice(0, 5)
    .map((o) => ({ id: o.id, name: ownerName(o.id), val: '…' }));
}

function Leaderboard({
  title,
  note,
  rows,
}: {
  title: string;
  note?: string;
  rows: { id: string; name: string; val: string }[];
}) {
  return (
    <Card>
      <div className="card-head">
        <span className="card-title">{title}</span>
        {note && <span className="card-hint">{note}</span>}
      </div>
      <div className="card-pad" style={{ paddingTop: 6, paddingBottom: 6 }}>
        {rows.map((r, i) => (
          <div key={r.id} className="record-row">
            <span className={'record-rank' + (i === 0 ? ' top' : '')}>{i + 1}</span>
            <div className="record-main">
              <OwnerChip id={r.id} name={r.name} />
            </div>
            <span className="tnum" style={{ fontWeight: 600, color: i === 0 ? 'var(--gold-2)' : 'var(--ink)' }}>
              {r.val}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
