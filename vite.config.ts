import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Connect, Plugin } from 'vite';
import pkg from './package.json' with { type: 'json' };
import { fcfResponse } from './src/server/fcf.js';

/** En desarrollo y en `vite preview` sirve /api/fcf igual que la función de Vercel. */
function fcfApi(): Plugin {
  const mw: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith('/api/fcf')) return next();
    void fcfResponse(new URL(req.url, 'http://localhost')).then(async (r) => {
      res.statusCode = r.status;
      r.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(await r.text());
    });
  };
  return { name: 'fcf-api', configureServer: (s) => void s.middlewares.use(mw), configurePreviewServer: (s) => void s.middlewares.use(mw) };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    fcfApi(),
    VitePWA({
      registerType: 'autoUpdate',
      // Se registra a mano en main.tsx solo en web: en las apps nativas el código ya va empaquetado.
      injectRegister: null,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mi Equipo FC',
        short_name: 'MiEquipo',
        description: 'Gestión de plantilla, partidos, entrenamientos y análisis para entrenadores de fútbol.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3f5f9',
        theme_color: '#14284b',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Supabase requests always go to the network; the app has its own offline outbox.
        runtimeCaching: [],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
