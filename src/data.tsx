import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isFormerOwner } from './lib/former';
import type { League, Owner, Season } from './types';

const SHOW_FORMER_KEY = 'affl:show-former';

interface Ctx {
  league: League;
  ownerById: Map<string, Owner>;
  seasonByYear: Map<number, Season>;
  /** Public-facing franchise / team label (preferred everywhere on the site). */
  ownerName: (id: string) => string;
  /** Legal manager name for owner tracking / profile headers. */
  managerName: (id: string) => string;
  /** Most recent (or year-specific) team name for an owner. */
  teamLabel: (id: string, year?: number) => string;
  /** Has this franchise stopped appearing in the latest season? */
  isFormer: (id: string) => boolean;
  /** Site-wide archive toggle: are former franchises currently shown? */
  showFormer: boolean;
  setShowFormer: (v: boolean) => void;
  formerCount: number;
  /**
   * Owners for views that list franchises as a SET (all-time tables, the h2h matrix, leaderboards,
   * pickers). Season-scoped views must keep using `league.owners` — a 2018 page has to show 2018's
   * teams whether or not they still exist.
   */
  visibleOwners: Owner[];
}

const LeagueContext = createContext<Ctx | null>(null);

function latestTeamName(o: Owner | undefined, year?: number): string | null {
  if (!o) return null;
  if (year != null) {
    const s = o.seasons.find((x) => x.year === year);
    if (s?.teamName) return s.teamName;
  }
  const sorted = [...o.seasons].sort((a, b) => b.year - a.year);
  if (sorted[0]?.teamName) return sorted[0].teamName;
  if (o.teamNames?.length) return o.teamNames[o.teamNames.length - 1];
  return null;
}

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [league, setLeague] = useState<League | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Archived by default; the choice sticks across visits. Storage can throw in private mode.
  const [showFormer, setShowFormerState] = useState(() => {
    try {
      return localStorage.getItem(SHOW_FORMER_KEY) === '1';
    } catch {
      return false;
    }
  });
  const setShowFormer = (v: boolean) => {
    setShowFormerState(v);
    try {
      localStorage.setItem(SHOW_FORMER_KEY, v ? '1' : '0');
    } catch {
      /* preference is best-effort */
    }
  };

  useEffect(() => {
    fetch('./data/league.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: League) => setLeague(d))
      .catch((e) => setError(String(e)));
  }, []);

  const value = useMemo<Ctx | null>(() => {
    if (!league) return null;
    const ownerById = new Map(league.owners.map((o) => [o.id, o]));
    const seasonByYear = new Map(league.seasons.map((s) => [s.year, s]));
    const managerName = (id: string) =>
      league.ownerNames[id] ?? ownerById.get(id)?.displayName ?? ownerById.get(id)?.name ?? 'Unknown Manager';
    const teamLabel = (id: string, year?: number) => {
      const o = ownerById.get(id);
      return latestTeamName(o, year) ?? managerName(id);
    };
    // Site-wide default display is franchise/team name; owner ids still track managers.
    const ownerName = (id: string) => teamLabel(id);

    const lastSeason = league.meta.lastSeason;
    const formerIds = new Set(
      league.owners.filter((o) => isFormerOwner(o, lastSeason)).map((o) => o.id),
    );
    const isFormer = (id: string) => formerIds.has(id);
    const visibleOwners = showFormer ? league.owners : league.owners.filter((o) => !formerIds.has(o.id));

    return {
      league, ownerById, seasonByYear, ownerName, managerName, teamLabel,
      isFormer, showFormer, setShowFormer, formerCount: formerIds.size, visibleOwners,
    };
  }, [league, showFormer]);

  if (error) {
    return (
      <div className="load-state">
        <div className="load-card">
          <h1>Couldn't load league data</h1>
          <p>{error}</p>
          <p className="muted">Run <code>npm run refresh</code> to regenerate the data file.</p>
        </div>
      </div>
    );
  }
  if (!value) {
    return (
      <div className="load-state">
        <div className="loader" aria-label="Loading league history">
          <div className="loader-ball" />
          <p>Loading league history…</p>
        </div>
      </div>
    );
  }
  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague(): Ctx {
  const ctx = useContext(LeagueContext);
  if (!ctx) throw new Error('useLeague must be used within LeagueProvider');
  return ctx;
}
