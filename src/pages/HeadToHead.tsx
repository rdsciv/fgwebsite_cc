import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLeague } from '../data';
import { PageHead, SectionHead, Card } from '../components/bits';
import { OwnerChip } from '../components/OwnerChip';
import { fmt, fmt0, recordStr, initials, tierLabel } from '../lib/util';
import type { H2HCell, PlayoffTier } from '../types';

// Cell background: green wash for a winning record, red for a losing one,
// neutral when dead even. Opacity scales with how lopsided the series is.
function cellBg(c: H2HCell): string {
  const g = c.w + c.l + c.t;
  const p = g ? c.w / g : 0.5;
  const d = Math.abs(p - 0.5);
  if (d < 1e-6) return 'var(--surface-2)';
  const a = Math.min(0.85, 0.12 + d * 0.7);
  return p > 0.5 ? `rgba(55,207,131,${a})` : `rgba(236,106,106,${a})`;
}

export function HeadToHead() {
  const { league, ownerName } = useLeague();
  const { owners, headToHead } = league;

  // ---- Part 1: matrix scope toggle --------------------------------------
  const [scope, setScope] = useState<'core' | 'all'>('core');
  const mgrs = useMemo(() => {
    const base = scope === 'core' ? owners.filter((o) => o.nSeasons >= 6) : owners;
    return [...base].sort(
      (a, b) => b.allTime.wins - a.allTime.wins || a.name.localeCompare(b.name),
    );
  }, [owners, scope]);

  // ---- Rivalry superlatives (every pair that has met) -------------------
  const pairs = useMemo(() => {
    const out: { a: string; b: string; c: H2HCell; g: number }[] = [];
    for (let i = 0; i < owners.length; i++) {
      for (let j = i + 1; j < owners.length; j++) {
        const a = owners[i];
        const b = owners[j];
        const c = headToHead[a.id]?.[b.id];
        if (!c) continue;
        const g = c.w + c.l + c.t;
        if (g === 0) continue;
        out.push({ a: a.id, b: b.id, c, g });
      }
    }
    return out;
  }, [owners, headToHead]);

  const mostPlayed = useMemo(
    () => [...pairs].sort((x, y) => y.g - x.g)[0],
    [pairs],
  );
  const mostLopsided = useMemo(
    () =>
      pairs
        .filter((p) => p.g >= 8)
        .sort(
          (x, y) => Math.abs(y.c.w - y.c.l) - Math.abs(x.c.w - x.c.l) || y.g - x.g,
        )[0],
    [pairs],
  );
  const deadlocked = useMemo(
    () =>
      pairs
        .filter((p) => p.g >= 8)
        .sort(
          (x, y) => Math.abs(x.c.w - x.c.l) - Math.abs(y.c.w - y.c.l) || y.g - x.g,
        )[0],
    [pairs],
  );

  // ---- Part 2: rivalry breakdown selectors ------------------------------
  const byName = useMemo(
    () => [...owners].sort((a, b) => a.name.localeCompare(b.name)),
    [owners],
  );
  const byWins = useMemo(
    () => [...owners].sort((a, b) => b.allTime.wins - a.allTime.wins),
    [owners],
  );
  const defaultA = byWins[0].id;
  const defaultB =
    (byWins.find((o) => o.id !== defaultA && headToHead[defaultA]?.[o.id]) ??
      byWins[1]).id;

  const [aId, setAId] = useState(defaultA);
  const [bId, setBId] = useState(defaultB);

  const aName = ownerName(aId);
  const bName = ownerName(bId);
  const same = aId === bId;
  const series = same ? undefined : headToHead[aId]?.[bId];

  // Full game log for the selected pair, most recent first.
  const meetings = useMemo(() => {
    if (same) return [];
    const out: {
      year: number;
      mp: number;
      tier: PlayoffTier;
      aScore: number;
      bScore: number;
      winnerId: string | null;
    }[] = [];
    for (const s of league.seasons) {
      for (const m of s.matchups) {
        const ids = [m.home.ownerId, m.away.ownerId];
        if (!ids.includes(aId) || !ids.includes(bId)) continue;
        const aSide = m.home.ownerId === aId ? m.home : m.away;
        const bSide = m.home.ownerId === bId ? m.home : m.away;
        const winnerId =
          m.winner === 'HOME'
            ? m.home.ownerId
            : m.winner === 'AWAY'
              ? m.away.ownerId
              : null;
        out.push({
          year: m.year,
          mp: m.mp,
          tier: m.tier,
          aScore: aSide.score,
          bScore: bSide.score,
          winnerId,
        });
      }
    }
    return out.sort((x, y) => y.year - x.year || y.mp - x.mp);
  }, [league.seasons, aId, bId, same]);

  const bestA = useMemo(
    () =>
      meetings
        .filter((m) => m.winnerId === aId)
        .sort((x, y) => y.aScore - y.bScore - (x.aScore - x.bScore))[0],
    [meetings, aId],
  );
  const bestB = useMemo(
    () =>
      meetings
        .filter((m) => m.winnerId === bId)
        .sort((x, y) => y.bScore - y.aScore - (x.bScore - x.aScore))[0],
    [meetings, bId],
  );

  const leaderLabel = series
    ? series.w > series.l
      ? `${aName} leads`
      : series.l > series.w
        ? `${bName} leads`
        : 'Series tied'
    : '';

  const superlativeCard = (
    label: string,
    p: { a: string; b: string; c: H2HCell; g: number } | undefined,
    mode: 'played' | 'lopsided' | 'even',
  ) => {
    if (!p) return null;
    // Orient so the series leader reads first.
    const leaderIsA = p.c.w >= p.c.l;
    const leadId = leaderIsA ? p.a : p.b;
    const otherId = leaderIsA ? p.b : p.a;
    const W = leaderIsA ? p.c.w : p.c.l;
    const L = leaderIsA ? p.c.l : p.c.w;
    return (
      <Card className="card-pad">
        <div className="stat-label">{label}</div>
        <div className="record-val" style={{ fontSize: 30, marginTop: 6 }}>
          {mode === 'played'
            ? `${p.g} meetings`
            : mode === 'even'
              ? recordStr(p.c.w, p.c.l, p.c.t)
              : recordStr(W, L, p.c.t)}
        </div>
        <div className="record-sub" style={{ marginTop: 8 }}>
          {mode === 'lopsided' ? (
            <>
              <Link to={`/owners/${encodeURIComponent(leadId)}`} className="em-gold">
                {ownerName(leadId)}
              </Link>{' '}
              over{' '}
              <Link to={`/owners/${encodeURIComponent(otherId)}`}>{ownerName(otherId)}</Link>
            </>
          ) : (
            <>
              <Link to={`/owners/${encodeURIComponent(p.a)}`}>{ownerName(p.a)}</Link>
              {' vs '}
              <Link to={`/owners/${encodeURIComponent(p.b)}`}>{ownerName(p.b)}</Link>
            </>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="page">
      <PageHead
        eyebrow="League History"
        title="Head to Head"
        lede={
          <>
            Every meeting between every manager, all {league.meta.nSeasons} seasons deep.
            Read the grid, then dive into any single rivalry below.
          </>
        }
      />

      {/* Rivalry superlatives */}
      <div className="grid cols-3">
        {superlativeCard('Most-Played Rivalry', mostPlayed, 'played')}
        {superlativeCard('Most Lopsided', mostLopsided, 'lopsided')}
        {superlativeCard('Dead Even', deadlocked, 'even')}
      </div>

      {/* Part 1 — H2H matrix */}
      <div className="section">
        <SectionHead
          title="The Grid"
          note={`Each cell is the row manager's all-time record vs the column manager · ${mgrs.length} managers`}
          right={
            <div className="seg" role="tablist" aria-label="Manager scope">
              <button
                className={scope === 'core' ? 'active' : ''}
                onClick={() => setScope('core')}
              >
                Core (6+ seasons)
              </button>
              <button
                className={scope === 'all' ? 'active' : ''}
                onClick={() => setScope('all')}
              >
                All managers
              </button>
            </div>
          }
        />

        <div className="table-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="rowh" aria-hidden />
                {mgrs.map((c) => (
                  <th key={c.id} title={c.name}>
                    {initials(c.name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mgrs.map((r) => (
                <tr key={r.id}>
                  <th className="rowh">
                    <OwnerChip id={r.id} name={r.name} size={20} />
                  </th>
                  {mgrs.map((c) => {
                    if (r.id === c.id) return <td key={c.id} className="diag" />;
                    const cell = headToHead[r.id]?.[c.id];
                    if (!cell || cell.w + cell.l + cell.t === 0)
                      return <td key={c.id} className="diag" />;
                    return (
                      <td
                        key={c.id}
                        style={{ background: cellBg(cell) }}
                        title={`${r.name} vs ${c.name}: ${recordStr(cell.w, cell.l, cell.t)} · ${fmt0(cell.pf)}–${fmt0(cell.pa)} PF`}
                      >
                        {recordStr(cell.w, cell.l, cell.t)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="legend" style={{ marginTop: 12 }}>
          <span className="legend-item">
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: 'rgba(55,207,131,0.7)',
              }}
            />
            Winning record
          </span>
          <span className="legend-item">
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: 'rgba(236,106,106,0.7)',
              }}
            />
            Losing record
          </span>
          <span className="legend-item">
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background:
                  'repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 4px, transparent 4px, transparent 8px)',
                border: '1px solid var(--line)',
              }}
            />
            Never met
          </span>
          <span className="muted">Deeper color = more dominant.</span>
        </div>
      </div>

      {/* Part 2 — rivalry breakdown */}
      <div className="section">
        <SectionHead
          title="Rivalry Breakdown"
          note="Pick any two managers to see the whole story"
        />

        <div className="chip-row" style={{ marginBottom: 18, alignItems: 'center' }}>
          <select
            className="select"
            value={aId}
            onChange={(e) => setAId(e.target.value)}
            aria-label="Manager A"
          >
            {byName.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <span className="muted" style={{ fontWeight: 600 }}>
            vs
          </span>
          <select
            className="select"
            value={bId}
            onChange={(e) => setBId(e.target.value)}
            aria-label="Manager B"
          >
            {byName.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        {same ? (
          <Card>
            <div className="empty">Pick two different managers to see a rivalry.</div>
          </Card>
        ) : !series ? (
          <Card>
            <div className="empty">
              {aName} and {bName} have never faced off.
            </div>
          </Card>
        ) : (
          <>
            {/* Duel summary */}
            <Card className="card-pad">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 28,
                  flexWrap: 'wrap',
                }}
              >
                <DuelSide
                  id={aId}
                  name={aName}
                  pf={series.pf}
                  ppg={series.pf / (series.w + series.l + series.t)}
                  best={
                    bestA ? { margin: bestA.aScore - bestA.bScore, year: bestA.year } : null
                  }
                />

                <div style={{ textAlign: 'center', minWidth: 150 }}>
                  <div className="stat-label">Series</div>
                  <div
                    className="record-val"
                    style={{ fontSize: 52, lineHeight: 1, marginTop: 4 }}
                  >
                    {series.w}
                    <span className="muted" style={{ fontWeight: 400 }}>
                      –
                    </span>
                    {series.l}
                    {series.t > 0 && (
                      <span className="muted" style={{ fontWeight: 400 }}>
                        –{series.t}
                      </span>
                    )}
                  </div>
                  <div
                    className="em-gold"
                    style={{ fontWeight: 600, marginTop: 6, fontSize: 14 }}
                  >
                    {leaderLabel}
                  </div>
                  <div className="record-sub" style={{ marginTop: 2 }}>
                    {series.w + series.l + series.t} meetings
                  </div>
                </div>

                <DuelSide
                  id={bId}
                  name={bName}
                  pf={series.pa}
                  ppg={series.pa / (series.w + series.l + series.t)}
                  best={
                    bestB ? { margin: bestB.bScore - bestB.aScore, year: bestB.year } : null
                  }
                />
              </div>
            </Card>

            {/* Game log */}
            <div style={{ marginTop: 18 }}>
              <div className="table-wrap">
                <table className="data" style={{ minWidth: 620 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Season</th>
                      <th style={{ textAlign: 'left' }}>Round</th>
                      <th title={`${aName} – ${bName}`}>
                        {initials(aName)} – {initials(bName)}
                      </th>
                      <th style={{ textAlign: 'left' }}>Winner</th>
                      <th>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.map((m, i) => (
                      <tr key={`${m.year}-${m.mp}-${i}`}>
                        <td style={{ textAlign: 'left' }}>
                          <Link to={`/seasons/${m.year}`} className="em-gold">
                            {m.year}
                          </Link>
                        </td>
                        <td style={{ textAlign: 'left', color: 'var(--ink-2)' }}>
                          {m.tier === 'NONE' ? `Week ${m.mp}` : tierLabel(m.tier)}
                        </td>
                        <td>
                          <span
                            className={
                              m.aScore > m.bScore
                                ? 'wl-w'
                                : m.aScore < m.bScore
                                  ? 'wl-l'
                                  : ''
                            }
                          >
                            {fmt(m.aScore)}
                          </span>
                          <span className="muted"> – </span>
                          <span
                            className={
                              m.bScore > m.aScore
                                ? 'wl-w'
                                : m.bScore < m.aScore
                                  ? 'wl-l'
                                  : ''
                            }
                          >
                            {fmt(m.bScore)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'left' }}>
                          {m.winnerId === aId ? (
                            <span className="em-gold" style={{ fontWeight: 600 }}>
                              {aName}
                            </span>
                          ) : m.winnerId === bId ? (
                            <span>{bName}</span>
                          ) : (
                            <span className="muted">Tie</span>
                          )}
                        </td>
                        <td className="tnum">{fmt(Math.abs(m.aScore - m.bScore))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DuelSide({
  id,
  name,
  pf,
  ppg,
  best,
}: {
  id: string;
  name: string;
  pf: number;
  ppg: number;
  best: { margin: number; year: number } | null;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        minWidth: 180,
      }}
    >
      <OwnerChip id={id} name={name} size={40} />
      <div className="record-sub" style={{ textAlign: 'center' }}>
        <span className="tnum" style={{ color: 'var(--ink)', fontWeight: 600 }}>
          {fmt0(pf)}
        </span>{' '}
        total PF · {fmt(ppg)} PPG
      </div>
      <div className="record-sub" style={{ textAlign: 'center' }}>
        {best ? (
          <>
            Best win{' '}
            <span className="wl-w">+{fmt(best.margin)}</span> · {best.year}
          </>
        ) : (
          <span className="muted">No wins in series</span>
        )}
      </div>
    </div>
  );
}
