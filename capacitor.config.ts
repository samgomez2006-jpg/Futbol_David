import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.futboldavid.miequipo',
  appName: 'Mi Equipo FC',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
};

export default config;
