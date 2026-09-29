import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// En nativo usa almacenamiento persistente del sistema (UserDefaults / SharedPreferences),
// que iOS no purga como puede hacer con el localStorage del WebView. En web usa localStorage.
export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const { value } = await Preferences.get({ key });
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    await Preferences.set({ key, value: JSON.stringify(value) });
  },
  /**
   * Escritura SÍNCRONA (solo web) para el momento de cerrar la pestaña, cuando no hay tiempo de esperar a promesas.
   * Usa la misma clave que el plugin Preferences en web ('CapacitorStorage.' + clave).
   */
  setSync(key: string, value: unknown): boolean {
    if (Capacitor.isNativePlatform()) return false;
    try {
      localStorage.setItem(`CapacitorStorage.${key}`, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  },
  // Adaptador para supabase-js (guarda la sesión en el mismo almacenamiento).
  authAdapter: {
    getItem: async (key: string) => (await Preferences.get({ key })).value,
    setItem: async (key: string, value: string) => {
      await Preferences.set({ key, value });
    },
    removeItem: async (key: string) => {
      await Preferences.remove({ key });
    },
  },
};
