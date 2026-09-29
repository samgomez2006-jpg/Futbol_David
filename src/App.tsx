import { BarChart3, CalendarDays, House, Shield, Users } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router';
import { App as CapApp } from '@capacitor/app';
import { ConfirmHost, Toast } from './components/Overlays';
import { cloudEnabled } from './lib/supabase';
import { isNative } from './lib/platform';
import Account from './pages/Account';
import Analytics from './pages/Analytics';
import Attendance from './pages/Attendance';
import { AuthScreen, NewPassword } from './pages/Auth';
import Board from './pages/Board';
import Evaluations from './pages/Evaluations';
import Export from './pages/Export';
import Home from './pages/Home';
import LineupHistory from './pages/LineupHistory';
import MatchDetail from './pages/MatchDetail';
import Matches from './pages/Matches';
import Objectives from './pages/Objectives';
import { Onboarding } from './pages/Onboarding';
import PlayerDetail from './pages/PlayerDetail';
import Players from './pages/Players';
import Plays from './pages/Plays';
import Team from './pages/Team';
import Teams from './pages/Teams';
import { SheetHost } from './sheets/Sheets';
import { useAuth } from './store/auth';
import { useStore } from './store/store';
import { useUI } from './store/ui';

const NAV: [string, string, ReactNode][] = [
  ['/', 'Inicio', <House key="h" className="ico-lg" />],
  ['/plantilla', 'Plantilla', <Users key="u" className="ico-lg" />],
  ['/partidos', 'Partidos', <CalendarDays key="c" className="ico-lg" />],
  ['/analiticas', 'Analíticas', <BarChart3 key="b" className="ico-lg" />],
  ['/equipo', 'Equipo', <Shield key="s" className="ico-lg" />],
];

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Principal">
      {NAV.map(([to, label, icon]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          {icon}
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

function MainApp() {
  return (
    <BrowserRouter>
      <div className="app">
        <main className="pages">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/plantilla" element={<Players />} />
            <Route path="/plantilla/:id" element={<PlayerDetail />} />
            <Route path="/partidos" element={<Matches />} />
            <Route path="/partidos/:id" element={<MatchDetail />} />
            <Route path="/analiticas" element={<Analytics />} />
            <Route path="/equipo" element={<Team />} />
            <Route path="/equipos" element={<Teams />} />
            <Route path="/cuenta" element={<Account />} />
            <Route path="/exportar" element={<Export />} />
            <Route path="/asistencia" element={<Attendance />} />
            <Route path="/alineaciones" element={<LineupHistory />} />
            <Route path="/evaluaciones" element={<Evaluations />} />
            <Route path="/objetivos" element={<Objectives />} />
            <Route path="/pizarra" element={<Board />} />
            <Route path="/pizarra/:id" element={<Board />} />
            <Route path="/jugadas" element={<Plays />} />
            {/* Rutas de versiones anteriores (la pestaña «Táctico» ya no existe) */}
            <Route path="/analisis" element={<Navigate to="/analiticas" replace />} />
            <Route path="/partidos/papelera" element={<Navigate to="/partidos?tab=papelera" replace />} />
            <Route path="/convocatorias" element={<Navigate to="/asistencia?tab=convocatorias" replace />} />
            <Route path="/tactico" element={<Navigate to="/" replace />} />
            <Route path="/tactico/evaluaciones" element={<Navigate to="/evaluaciones" replace />} />
            <Route path="/tactico/objetivos" element={<Navigate to="/objetivos" replace />} />
            <Route path="/tactico/convocatorias" element={<Navigate to="/asistencia?tab=convocatorias" replace />} />
            <Route path="/tactico/alineaciones" element={<Navigate to="/alineaciones" replace />} />
            <Route path="/tactico/asistencia" element={<Navigate to="/asistencia" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
      <SheetHost />
      <HardwareBack />
      <ScrollReset />
    </BrowserRouter>
  );
}

/** Con Supabase configurado la app exige sesión y equipo; sin él funciona en local (desarrollo). */
function Gate() {
  const status = useAuth((s) => s.status);
  const mode = useStore((s) => s.mode);
  if (!cloudEnabled) return <MainApp />;
  if (status === 'loading') return <div className="splash" aria-busy="true"><Shield className="ico-lg" /></div>;
  if (status === 'recovery') return <NewPassword />;
  if (status === 'signedOut') return <AuthScreen />;
  if (mode !== 'cloud') return <Onboarding />;
  return <MainApp />;
}

export default function App() {
  return (
    <>
      <Gate />
      <ConfirmHost />
      <Toast />
    </>
  );
}
