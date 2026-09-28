import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { App as CapApp } from '@capacitor/app';
import { ConfirmHost, Toast } from './components/Overlays';
import { isNative } from './lib/platform';
import Account from './pages/Account';
import Analysis from './pages/Analysis';
import Home from './pages/Home';
import MatchDetail from './pages/MatchDetail';
import Matches from './pages/Matches';
import PlayerDetail from './pages/PlayerDetail';
import Players from './pages/Players';
import { Attendance, Callups, Evaluations, LineupHistory, Objectives, TacticalHub } from './pages/Tactical';
import { SheetHost } from './sheets/Sheets';
import { useUI } from './store/ui';

const NAV: [string, string, ReactNode][] = [
  ['/', 'Inicio', <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9,22 9,12 15,12 15,22" /></>],
  ['/plantilla', 'Plantilla', <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></>],
  ['/partidos', 'Partidos', <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>],
  ['/analisis', 'Análisis', <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>],
  ['/tactico', 'Táctico', <><circle cx="12" cy="12" r="10" /><path d="M12 2a15 15 0 010 20M2 12h20" /></>],
];

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Principal">
      {NAV.map(([to, label, icon]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <svg viewBox="0 0 24 24" aria-hidden>{icon}</svg>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Botón atrás de Android: cierra hojas → vuelve de pantalla → sale de la app. */
function HardwareBack() {
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    if (!isNative) return;
    const h = CapApp.addListener('backButton', () => {
      const ui = useUI.getState();
      if (ui.confirmSpec) return ui._resolveConfirm(false);
      if (ui.sheets.length) return ui.close();
      if (loc.pathname !== '/') return loc.key !== 'default' ? nav(-1) : nav('/', { replace: true });
      void CapApp.exitApp();
    });
    return () => void h.then((x) => x.remove());
  }, [nav, loc]);
  return null;
}

function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.querySelector('.page')?.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <main className="pages">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/plantilla" element={<Players />} />
            <Route path="/plantilla/:id" element={<PlayerDetail />} />
            <Route path="/partidos" element={<Matches />} />
            <Route path="/partidos/papelera" element={<Matches trash />} />
            <Route path="/partidos/:id" element={<MatchDetail />} />
            <Route path="/analisis" element={<Analysis />} />
            <Route path="/tactico" element={<TacticalHub />} />
            <Route path="/tactico/evaluaciones" element={<Evaluations />} />
            <Route path="/tactico/objetivos" element={<Objectives />} />
            <Route path="/tactico/convocatorias" element={<Callups />} />
            <Route path="/tactico/alineaciones" element={<LineupHistory />} />
            <Route path="/tactico/asistencia" element={<Attendance />} />
            <Route path="/cuenta" element={<Account />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
      <SheetHost />
      <ConfirmHost />
      <Toast />
      <HardwareBack />
      <ScrollReset />
    </BrowserRouter>
  );
}
