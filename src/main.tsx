import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { isNative } from './lib/platform';
import { initAuth } from './store/auth';
import { useStore } from './store/store';
import { startSync } from './store/sync';
import './styles.css';

function Root() {
  const ready = useStore((s) => s.ready);
  useEffect(() => {
    void useStore.getState().hydrate().then(async () => {
      startSync();
      await initAuth();
      if (isNative) void SplashScreen.hide();
    });
    if (isNative) {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    }
  }, []);
  if (!ready) return <div className="splash" aria-busy="true">⚽</div>;
  return <App />;
}

if (!isNative) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
