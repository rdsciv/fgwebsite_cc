import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { LeagueProvider } from './data';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <LeagueProvider>
        <App />
      </LeagueProvider>
    </HashRouter>
  </React.StrictMode>,
);
