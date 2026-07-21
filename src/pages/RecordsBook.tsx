import { useState, type ReactNode } from 'react';
import { useLeague } from '../data';
import { PageHead, SectionHead, StatTile, Card } from '../components/bits';
import { OwnerChip } from '../components/OwnerChip';
import { fmt, fmt0, recordStr, tierLabel, posColor } from '../lib/util';
import type { PlayoffTier } from '../types';

const TABS = ['Scoring', 'Games', 'Seasons', 'Streaks & Draft'] as const;
type Tab = (typeof TABS)[number];

interface RowData {
  key: string | number;
  main: ReactNode;
  sub: ReactNode;
  val: ReactNode;
}

// Only annotate playoff/consolation games — regular-season is the silent default.
const tierSuffix = (t: PlayoffTier) => (t !== 'NONE' ? ` · ${tierLabel(t)}` : '');

function RecordPanel({ title, note, rows }: { title: string; note?: string; rows: RowData[] }) {
  return (
    <Card>
      <div className="card-head">
        <span className="card-title">{title}</span>
        {note && <span className="card-hint">{note}</span>}
      </div>
      <div className="record-list" style={{ padding: '4px 18px 10px' }}>
        {rows.map((r, i) => (
          <div key={r.key} className="record-row">
            <span className={'record-rank' + (i === 0 ? ' top' : '')}>{i + 1}</span>
            <div className="record-main">
              {r.main}
              <div className="record-sub">{r.sub}</div>
            </div>
            <span
              className="record-val"
              style={{ color: i === 0 ? 'var(--gold-2)' : 'var(--ink)', flex: 'none' }}
            >
              {r.val}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Col({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>;
}

function Name({ children }: { children: ReactNode }) {
  return <span className="owner-nm">{children}</span>;
}

export function RecordsBook() {
  const { league } = useLeague();
  const { records } = league;
  const [tab, setTab] = useState<Tab>('Scoring');

  const top = records.biggestBids[0];

  // ---- SCORING ----------------------------------------------------------
  const topWeeks: RowData[] = records.topWeeks.slice(0, 12).map((w) => ({
    key: `${w.year}-${w.week}-${w.ownerId}`,
    main: <OwnerChip id={w.ownerId} name={w.owner} />,
    sub: `${w.year} · Week ${w.week}`,
    val: fmt(w.score),
  }));
  const lowWeeks: RowData[] = records.lowWeeks.slice(0, 12).map((w) => ({
    key: `${w.year}-${w.week}-${w.ownerId}`,
    main: <OwnerChip id={w.ownerId} name={w.owner} />,
    sub: `${w.year} · Week ${w.week}`,
    val: fmt(w.score),
  }));

  // ---- GAMES ------------------------------------------------------------
  const blowouts: RowData[] = records.blowouts.slice(0, 12).map((b, i) => ({
    key: i,
    main: (
      <span>
        <Name>{b.winner}</Name> <span className="muted">def.</span> {b.loser}
      </span>
    ),
    sub: `${b.year} · Wk ${b.week}${tierSuffix(b.tier)} · ${fmt(b.winScore)}–${fmt(b.loseScore)}`,
    val: `+${fmt(b.margin)}`,
  }));
  const nailbiters: RowData[] = records.nailbiters.slice(0, 12).map((b, i) => ({
    key: i,
    main: (
      <span>
        <Name>{b.winner}</Name> <span className="muted">edged</span> {b.loser}
      </span>
    ),
    sub: `${b.year} · Wk ${b.week}${tierSuffix(b.tier)} · ${fmt(b.winScore)}–${fmt(b.loseScore)}`,
    val: fmt(b.margin),
  }));
  const shootouts: RowData[] = records.shootouts.slice(0, 12).map((s, i) => ({
    key: i,
    main: (
      <span>
        <Name>{s.home}</Name> <span className="muted">vs</span> <Name>{s.away}</Name>
      </span>
    ),
    sub: `${s.year} · Wk ${s.week}${tierSuffix(s.tier)} · ${fmt(s.homeScore)}–${fmt(s.awayScore)}`,
    val: fmt(s.combined),
  }));
  const mostInLoss: RowData[] = records.mostInLoss.slice(0, 12).map((m, i) => ({
    key: i,
    main: <Name>{m.owner}</Name>,
    sub: `${m.year} · Wk ${m.week}${tierSuffix(m.tier)} · lost to ${m.opp} ${fmt(m.oppScore)}`,
    val: fmt(m.score),
  }));
  const fewestInWin: RowData[] = records.fewestInWin.slice(0, 12).map((m, i) => ({
    key: i,
    main: <Name>{m.owner}</Name>,
    sub: `${m.year} · Wk ${m.week}${tierSuffix(m.tier)} · beat ${m.opp} ${fmt(m.oppScore)}`,
    val: fmt(m.score),
  }));

  // ---- SEASONS ----------------------------------------------------------
  const bestSeasonPF: RowData[] = records.bestSeasonPF.slice(0, 12).map((s, i) => ({
    key: i,
    main: (
      <span>
        <Name>{s.owner}</Name>
        <span className="owner-team" style={{ display: 'block' }}>{s.teamName}</span>
      </span>
    ),
    sub: `${s.year} · ${recordStr(s.wins, s.losses, 0)} · ${fmt(s.ppg)} ppg`,
    val: fmt0(s.pf),
  }));
  const worstSeasonPF: RowData[] = records.worstSeasonPF.slice(0, 12).map((s, i) => ({
    key: i,
    main: (
      <span>
        <Name>{s.owner}</Name>
        <span className="owner-team" style={{ display: 'block' }}>{s.teamName}</span>
      </span>
    ),
    sub: `${s.year} · ${recordStr(s.wins, s.losses, 0)} · ${fmt(s.ppg)} ppg`,
    val: fmt0(s.pf),
  }));

  // ---- STREAKS & DRAFT --------------------------------------------------
  const longestWin: RowData[] = records.longestWin.slice(0, 12).map((s) => ({
    key: s.ownerId,
    main: <OwnerChip id={s.ownerId} name={s.owner} />,
    sub: s.maxWspan ?? '—',
    val: `${s.maxW} W`,
  }));
  const longestLose: RowData[] = records.longestLose.slice(0, 12).map((s) => ({
    key: s.ownerId,
    main: <OwnerChip id={s.ownerId} name={s.owner} />,
    sub: s.maxLspan ?? '—',
    val: `${s.maxL} L`,
  }));
  const biggestBids: RowData[] = records.biggestBids.slice(0, 12).map((b, i) => ({
    key: i,
    main: (
      <span>
        <span className="pos-dot" style={{ background: posColor(b.pos) }} />
        <Name>{b.player}</Name>{' '}
        <span className="muted" style={{ fontSize: 12 }}>{b.pos}</span>
      </span>
    ),
    sub: `${b.owner} · ${b.year}`,
    val: `$${b.bid}`,
  }));

  return (
    <div className="page">
      <PageHead
        eyebrow="The Book"
        title="Record Book"
        lede={
          <>
            The extremes of {league.meta.nSeasons} seasons — the biggest weeks, the tightest
            finishes, the season-long tears and the draft-day splurges. Top 12 in every category.
          </>
        }
      />

      <div className="grid cols-4">
        <StatTile
          label="Highest Single Week"
          value={fmt(records.singleHigh.score)}
          accent="gold"
          sub={`${records.singleHigh.owner} · ${records.singleHigh.year}`}
        />
        <StatTile
          label="Biggest Blowout"
          value={`+${fmt(records.biggestBlowout.margin)}`}
          accent="green"
          sub={`${records.biggestBlowout.winner} · ${records.biggestBlowout.year}`}
        />
        <StatTile
          label="Highest Shootout"
          value={fmt(records.highestShootout.combined)}
          sub={`${records.highestShootout.year} · Wk ${records.highestShootout.week}`}
        />
        <StatTile
          label="Top Auction Bid"
          value={`$${top?.bid ?? 0}`}
          sub={top ? `${top.player} · ${top.owner}` : '—'}
        />
      </div>

      <div className="section">
        <SectionHead
          title="Every Record, Ranked"
          note="Tap a manager to open their career page."
        />
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={'tab' + (t === tab ? ' active' : '')}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Scoring' && (
          <div className="two-col">
            <Col>
              <RecordPanel title="Highest Single Weeks" note="team points, one week" rows={topWeeks} />
            </Col>
            <Col>
              <RecordPanel title="Lowest Single Weeks" note="team points, one week" rows={lowWeeks} />
            </Col>
          </div>
        )}

        {tab === 'Games' && (
          <div className="two-col">
            <Col>
              <RecordPanel title="Biggest Blowouts" note="winning margin" rows={blowouts} />
              <RecordPanel title="Highest-Scoring Games" note="combined points" rows={shootouts} />
              <RecordPanel title="Fewest Points in a Win" note="and still won" rows={fewestInWin} />
            </Col>
            <Col>
              <RecordPanel title="Closest Games" note="narrowest margin" rows={nailbiters} />
              <RecordPanel title="Most Points in a Loss" note="wasted heaters" rows={mostInLoss} />
            </Col>
          </div>
        )}

        {tab === 'Seasons' && (
          <div className="two-col">
            <Col>
              <RecordPanel title="Best Scoring Seasons" note="total points for" rows={bestSeasonPF} />
            </Col>
            <Col>
              <RecordPanel title="Lowest Scoring Seasons" note="total points for" rows={worstSeasonPF} />
            </Col>
          </div>
        )}

        {tab === 'Streaks & Draft' && (
          <div className="two-col">
            <Col>
              <RecordPanel title="Longest Win Streaks" note="consecutive wins" rows={longestWin} />
              <RecordPanel title="Longest Losing Streaks" note="consecutive losses" rows={longestLose} />
            </Col>
            <Col>
              <RecordPanel title="Biggest Auction Bids" note="single-player price" rows={biggestBids} />
            </Col>
          </div>
        )}
      </div>
    </div>
  );
}
