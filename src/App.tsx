import { Suspense, lazy } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useLeague } from './data';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { Overview } from './pages/Overview';
import logo from './assets/affl-logo.webp';

// Overview is eager (it is the landing route); every other page — and the ~400 KB of
// Recharts most of them pull in — is split out so the first paint doesn't wait on them.
const AllTimeStandings = lazy(() => import('./pages/AllTimeStandings').then((m) => ({ default: m.AllTimeStandings })));
const HeadToHead = lazy(() => import('./pages/HeadToHead').then((m) => ({ default: m.HeadToHead })));
const RecordsBook = lazy(() => import('./pages/RecordsBook').then((m) => ({ default: m.RecordsBook })));
const SeasonPage = lazy(() => import('./pages/SeasonPage').then((m) => ({ default: m.SeasonPage })));
const OwnerProfile = lazy(() => import('./pages/OwnerProfile').then((m) => ({ default: m.OwnerProfile })));
const Drafts = lazy(() => import('./pages/Drafts').then((m) => ({ default: m.Drafts })));
const Trends = lazy(() => import('./pages/Trends').then((m) => ({ default: m.Trends })));
const Scoreboard = lazy(() => import('./pages/Scoreboard').then((m) => ({ default: m.Scoreboard })));
const RosterLab = lazy(() => import('./pages/RosterLab').then((m) => ({ default: m.RosterLab })));
const RotoStandings = lazy(() => import('./pages/RotoStandings').then((m) => ({ default: m.RotoStandings })));

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/standings', label: 'All-Time' },
  { to: '/scoreboard', label: 'Scoreboards' },
  { to: '/head-to-head', label: 'Head-to-Head' },
  { to: '/records', label: 'Records' },
  { to: '/seasons', label: 'Seasons' },
  { to: '/drafts', label: 'Drafts' },
  { to: '/roster-lab', label: 'Roster Lab' },
  { to: '/roto-standings', label: 'Roto Standings' },
  { to: '/trends', label: 'Trends' },
];

// Site-wide archive control. It lives in the header so no franchise-set view can be quietly
// filtered without the reason being on screen.
function FormerToggle() {
  const { showFormer, setShowFormer, formerCount } = useLeague();
  if (!formerCount) return null;
  return (
    <label className="former-toggle" title={`${formerCount} franchises no longer in the league`}>
      <input type="checkbox" checked={showFormer} onChange={(e) => setShowFormer(e.target.checked)} />
      <span>Former teams</span>
      <span className="former-toggle-count">{formerCount}</span>
    </label>
  );
}

function Nav() {
  return (
    <header className="site-header">
      <div className="nav-inner">
        <NavLink to="/" end className="brand" aria-label="AFFL home">
          <img className="brand-mark" src={logo} alt="" width={34} height={34} />
          <span className="brand-word">AFFL</span>
        </NavLink>
        <nav className="nav-links" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <FormerToggle />
      </div>
    </header>
  );
}

function SeasonsIndex() {
  const { league } = useLeague();
  return <Navigate to={`/seasons/${league.meta.lastSeason}`} replace />;
}

function SeasonRoute() {
  const { year } = useParams();
  return <SeasonPage year={Number(year)} />;
}

function Footer() {
  const { league } = useLeague();
  return (
    <footer className="footer">
      AFFL League History · {league.meta.nSeasons} seasons · {league.meta.nOwners} managers ·
      data via ESPN · rebuild with <code>npm run refresh</code>
    </footer>
  );
}

export function App() {
  // Keying the boundary on the path resets it on navigation — otherwise one failed chunk would
  // leave the error state pinned across every subsequent route change.
  const { pathname } = useLocation();
  return (
    <>
      <Nav />
      <main>
        <RouteErrorBoundary key={pathname}>
          <Suspense fallback={<div className="page"><div className="empty">Loading…</div></div>}>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/standings" element={<AllTimeStandings />} />
              <Route path="/head-to-head" element={<HeadToHead />} />
              <Route path="/records" element={<RecordsBook />} />
              <Route path="/scoreboard" element={<Scoreboard />} />
              <Route path="/seasons" element={<SeasonsIndex />} />
              <Route path="/seasons/:year" element={<SeasonRoute />} />
              <Route path="/owners/:id" element={<OwnerProfile />} />
              <Route path="/drafts" element={<Drafts />} />
              <Route path="/roster-lab" element={<RosterLab />} />
              <Route path="/roto-standings" element={<RotoStandings />} />
              <Route path="/trends" element={<Trends />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </main>
      <Footer />
    </>
  );
}
