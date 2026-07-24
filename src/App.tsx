import { NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useLeague } from './data';
import { Overview } from './pages/Overview';
import { AllTimeStandings } from './pages/AllTimeStandings';
import { HeadToHead } from './pages/HeadToHead';
import { RecordsBook } from './pages/RecordsBook';
import { SeasonPage } from './pages/SeasonPage';
import { OwnerProfile } from './pages/OwnerProfile';
import { Drafts } from './pages/Drafts';
import { Trends } from './pages/Trends';
import { Scoreboard } from './pages/Scoreboard';
import { RosterLab } from './pages/RosterLab';
import { RotoStandings } from './pages/RotoStandings';
import banner from './assets/affl-banner.jpg';

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

function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="brand" aria-label="AFFL">
          <img className="brand-banner" src={banner} alt="AFFL" />
        </NavLink>
        <div className="nav-links">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
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
  return (
    <>
      <Nav />
      <main>
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
      </main>
      <Footer />
    </>
  );
}
