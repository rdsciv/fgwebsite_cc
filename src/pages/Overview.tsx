import { Link } from 'react-router-dom';
import { useLeague } from '../data';
import { SectionHead, StatTile, Card } from '../components/bits';
import logo from '../assets/affl-logo.png';
import { OwnerChip, Avatar } from '../components/OwnerChip';
import { fmt0, ordinal, pct, recordStr } from '../lib/util';

export function Overview() {
  const { league, ownerName, seasonByYear } = useLeague();
  const { meta, owners, championsTimeline, records } = league;

  const totalGames = league.seasons.reduce((a, s) => a + s.matchups.length, 0);
  const totalPoints = league.seasons.reduce((a, s) => a + s.teams.reduce((b, t) => b + t.pf, 0), 0);
  const distinctChamps = new Set(championsTimeline.filter((c) => c.champion).map((c) => c.champion!.ownerId)).size;

  const reign = championsTimeline[championsTimeline.length - 1];
  const reignSeason = seasonByYear.get(reign.year);
  const reignTeam = reignSeason?.teams.find((t) => t.finalRank === 1);

  const mostTitles = [...owners].sort((a, b) => b.allTime.championships - a.allTime.championships || b.allTime.wins - a.allTime.wins).slice(0, 5);
  const bestPct = [...owners].filter((o) => o.allTime.gamesPlayed >= 40).sort((a, b) => b.allTime.pct - a.allTime.pct).slice(0, 5);
  const mostPoints = [...owners].sort((a, b) => b.allTime.pf - a.allTime.pf).slice(0, 5);

  return (
    <div className="page">
      <header className="page-head brand-head">
        <img className="brand-logo" src={logo} alt="" />
        <div>
          <div className="page-eyebrow">League History</div>
          <h1 className="page-title">AFFL</h1>
        </div>
      </header>

      <div className="grid cols-4">
        <StatTile label="Seasons" value={meta.nSeasons} accent="gold" sub={`${meta.firstSeason}–${meta.lastSeason}`} />
        <StatTile label="Managers" value={meta.nOwners} sub="all-time franchises" />
        <StatTile label="Games Played" value={fmt0(totalGames)} accent="green" sub="regular season + playoffs" />
        <StatTile label="Points Scored" value={fmt0(totalPoints)} sub={`across ${meta.nSeasons} seasons`} />
      </div>

      {/* reigning champion spotlight */}
      <div className="section">
        <div className="reign-card card">
          <div className="reign-glow" />
          <div className="reign-body">
            <div className="reign-tag">🏆 Reigning Champion · {reign.year}</div>
            <div className="reign-name">{reign.champion ? ownerName(reign.champion.ownerId) : '—'}</div>
            <div className="reign-team">{reign.champion?.teamName}</div>
            {reignTeam && (
              <div className="reign-meta">
                <span className="pill">{recordStr(reignTeam.wins, reignTeam.losses, reignTeam.ties)}</span>
                <span className="pill">{fmt0(reignTeam.pf)} PF</span>
                <span className="pill">{ordinal(reignTeam.regRank)} in regular season</span>
              </div>
            )}
            {reign.champion && (
              <Link to={`/owners/${encodeURIComponent(reign.champion.ownerId)}`} className="link-arrow" style={{ marginTop: 14, display: 'inline-block' }}>
                View career →
              </Link>
            )}
          </div>
          <div className="reign-trophy">🏆</div>
        </div>
      </div>

      {/* hall of champions */}
      <div className="section">
        <SectionHead title="Hall of Champions" note="Every title winner in league history" right={<Link to="/seasons" className="link-arrow">Browse seasons →</Link>} />
        <div className="champ-strip">
          {[...championsTimeline].reverse().map((c) => (
            <Link key={c.year} to={`/seasons/${c.year}`} className="champ-cell">
              <span className="trophy">🏆</span>
              <div className="yr">{c.year}</div>
              <div className="cn">{c.champion ? ownerName(c.champion.ownerId) : '—'}</div>
              <div className="ct">{c.champion?.teamName}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* leaderboards */}
      <div className="section">
        <SectionHead title="All-Time Leaders" right={<Link to="/standings" className="link-arrow">Full standings →</Link>} />
        <div className="grid cols-3">
          <Leaderboard title="Most Championships" rows={mostTitles.map((o) => ({ id: o.id, name: o.name, val: o.allTime.championships === 0 ? '—' : '🏆'.repeat(Math.min(o.allTime.championships, 5)) }))} />
          <Leaderboard title="Best Win %" note="min. 40 games" rows={bestPct.map((o) => ({ id: o.id, name: o.name, val: pct(o.allTime.pct) }))} />
          <Leaderboard title="Most Points Scored" rows={mostPoints.map((o) => ({ id: o.id, name: o.name, val: fmt0(o.allTime.pf) }))} />
        </div>
      </div>

      {/* single-game superlatives */}
      <div className="section">
        <SectionHead title="Signature Moments" right={<Link to="/records" className="link-arrow">Record book →</Link>} />
        <div className="grid cols-3">
          <Card className="card-pad">
            <div className="stat-label">Highest Single Week</div>
            <div className="record-val" style={{ fontSize: 30, marginTop: 6 }}>{records.singleHigh.score.toFixed(2)}</div>
            <div className="record-sub">{records.singleHigh.owner} · {records.singleHigh.year} Wk {records.singleHigh.week}</div>
          </Card>
          <Card className="card-pad">
            <div className="stat-label">Biggest Blowout</div>
            <div className="record-val" style={{ fontSize: 30, marginTop: 6 }}>+{records.biggestBlowout.margin.toFixed(2)}</div>
            <div className="record-sub">{records.biggestBlowout.winner} def. {records.biggestBlowout.loser} · {records.biggestBlowout.year}</div>
          </Card>
          <Card className="card-pad">
            <div className="stat-label">Biggest Auction Bid</div>
            <div className="record-val" style={{ fontSize: 30, marginTop: 6 }}>${records.biggestBids[0]?.bid}</div>
            <div className="record-sub">{records.biggestBids[0]?.player} · {records.biggestBids[0]?.owner} · {records.biggestBids[0]?.year}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Leaderboard({ title, note, rows }: { title: string; note?: string; rows: { id: string; name: string; val: string }[] }) {
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
            <span className="tnum" style={{ fontWeight: 600, color: i === 0 ? 'var(--gold-2)' : 'var(--ink)' }}>{r.val}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
