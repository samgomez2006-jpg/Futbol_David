import { isNative } from '../platform';
import type { FcfActa, FcfGroupData, FcfOption } from './types';

// En web la función vive en el mismo dominio; en las apps nativas se llama a la web publicada.
const BASE = (import.meta.env.VITE_FCF_API as string | undefined) || (isNative ? 'https://futbol-david.vercel.app/api/fcf' : '/api/fcf');

async function call<T>(params: Record<string, string>): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}?${new URLSearchParams(params)}`);
  } catch {
    throw new Error('Sin conexión: no se pudieron consultar los datos de la FCF.');
  }
  const body = (await r.json().catch(() => null)) as T | { error?: string } | null;
  if (!r.ok) throw new Error((body as { error?: string } | null)?.error ?? `Error ${r.status} al consultar la FCF`);
  return body as T;
}

export const fcfApi = {
  seasons: () => call<FcfOption[]>({ op: 'seasons' }),
  disciplines: () => call<FcfOption[]>({ op: 'disciplines' }),
  competitions: (discipline: string, season: string) => call<FcfOption[]>({ op: 'competitions', discipline, season }),
  groups: (competition: string) => call<FcfOption[]>({ op: 'groups', competition }),
  group: (group: string, season: string) => call<FcfGroupData>({ op: 'group', group, season }),
  acta: (id: string) => call<FcfActa>({ op: 'acta', id }),
};
