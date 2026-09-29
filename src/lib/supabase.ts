import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { storage } from './storage';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** null si no hay Supabase configurado: la app funciona igual en modo local. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: storage.authAdapter,
          persistSession: true,
          autoRefreshToken: true,
          // En nativo no hay URL con tokens que leer; en web sí (enlace mágico del email).
          detectSessionInUrl: !Capacitor.isNativePlatform(),
          // 'implicit' (no PKCE): el enlace del email funciona aunque se abra en otro navegador o en la app de correo,
          // que es la causa más habitual de que "falle el enlace de verificación" en el móvil.
          flowType: 'implicit',
        },
      })
    : null;

export const cloudEnabled = !!supabase;
