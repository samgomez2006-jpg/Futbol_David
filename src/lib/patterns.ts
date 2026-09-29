// Detección de patrones recurrentes en las observaciones que escribe el entrenador.
// Es un análisis léxico sencillo (palabras clave en español), no una comprensión del texto:
// por eso los resultados se presentan siempre como tendencias, nunca como conclusiones.

import { compareDateDesc } from './dates';
import type { Match } from './types';

export type PatternArea = 'Ataque' | 'Defensa' | 'Transiciones' | 'Balón parado' | 'Actitud y físico' | 'Juego';
export type Tone = 'negativo' | 'positivo' | 'neutro';

interface PatternDef {
  id: string;
  label: string;
  area: PatternArea;
  re: RegExp;
}

const DEFS: PatternDef[] = [
  { id: 'salida', label: 'Salida de balón', area: 'Juego', re: /salida (de|del) (balon|juego)|salir (jugando|desde atras)|inicio de (la )?jugada|construccion|primer pase/ },
  { id: 'perdidas', label: 'Pérdidas de balón', area: 'Juego', re: /perdida(s)? (de )?(balon|en )|perdemos (el )?balon|pierde(n)? (el )?balon|balones? perdid/ },
  { id: 'posesion', label: 'Posesión y circulación', area: 'Juego', re: /posesion|circulacion|juego combinativo|toque(s)? rapido|balon largo|pelotazo|juego directo/ },
  { id: 'presion', label: 'Presión', area: 'Defensa', re: /presion|pressing|presionar|robo (alto|en campo)/ },
  { id: 'centros', label: 'Centros y juego aéreo', area: 'Defensa', re: /centros?\b|juego aereo|remate(s)? de cabeza|balones? colgad|balon aereo/ },
  { id: 'marcajes', label: 'Marcajes y vigilancias', area: 'Defensa', re: /marcaje|vigilancia|perdemos (a )?(el )?hombre|no seguimos|pierden (a )?(el )?marca/ },
  { id: 'sistema', label: 'Defensa ante sistemas rivales', area: 'Defensa', re: /(defender|jugar|ante|contra|frente a) (un |el )?(sistema )?(4|3|5)-\d|linea de (tres|cinco|cuatro)|(sistema|esquema) (del )?rival|defensa de cinco/ },
  { id: 'trans-def', label: 'Transición defensiva', area: 'Transiciones', re: /transicion(es)? defensiva|repliegue|contraataque(s)? (del )?rival|espalda(s)? (de la )?defensa|nos (cogen|salen|hacen) (al )?contra/ },
  { id: 'trans-of', label: 'Transición ofensiva y contraataque', area: 'Transiciones', re: /transicion(es)? ofensiva|contraataque|salida rapida/ },
  { id: 'abp', label: 'Balón parado', area: 'Balón parado', re: /balon parado|corner|saque(s)? de esquina|falta(s)? (lateral|frontal|directa)|estrategia|\babp\b/ },
  { id: 'final', label: 'Últimos minutos', area: 'Actitud y físico', re: /ultimos minutos|final del partido|recta final|sobre el final|tramo final|ultimo cuarto/ },
  { id: 'inicio', label: 'Inicio del partido', area: 'Actitud y físico', re: /inicio del partido|primeros minutos|arranque|salimos dormidos|primer cuarto/ },
  { id: 'actitud', label: 'Concentración y actitud', area: 'Actitud y físico', re: /concentracion|desconcentr|actitud|despiste|apatia|competitividad|intensidad/ },
  { id: 'fisico', label: 'Aspecto físico', area: 'Actitud y físico', re: /fisic|cansancio|fatiga|condicion fisica|ritmo/ },
  { id: 'finalizacion', label: 'Finalización', area: 'Ataque', re: /finalizacion|definicion|falta de gol|no definimos|cara a cara|ocasion(es)? (claras?|falladas?|perdidas?)|remates?/ },
  { id: 'bandas', label: 'Juego por bandas', area: 'Ataque', re: /\bbandas?\b|laterales|extremos?/ },
];

const NEG = /problema|fallo|error|\bmal\b|perdid|perdemos|pierden|dificultad|sufrimos|sufre|encajamos|nos (marcan|hacen)|falta de|no (supimos|logramos|conseguimos|salimos|presionamos|defendimos|cerramos|definimos|llegamos)|desconcentr|lento|blando|regalamos|nos cuesta|debemos mejorar|mejorar/;
const POS = /\bbien\b|buen[ao]s?\b|acierto|domin|control|solido|efectiv|excelente|correct|mejor(amos|ó)|gran /;

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function tone(sentence: string): Tone {
  const n = NEG.test(sentence);
  const p = POS.test(sentence);
  return n && !p ? 'negativo' : p && !n ? 'positivo' : n && p ? 'negativo' : 'neutro';
}

export interface PatternExample {
  matchId: string;
  rival: string;
  date: string;
  text: string;
}
export interface Pattern {
  id: string;
  label: string;
  area: PatternArea;
  /** Partidos distintos en los que aparece. */
  matches: number;
  /** Partidos con alguna observación escrita. */
  observed: number;
  tone: Tone;
  examples: PatternExample[];
}

/** Texto observado de un partido: observaciones + incidencias anotadas. */
export const observationText = (m: Match): string =>
  [m.notes, ...m.incidents.map((i) => i.text)].map((t) => t.trim()).filter(Boolean).join('. ');

/** Un patrón necesita aparecer en al menos este número de partidos. */
export const MIN_PATTERN_MATCHES = 2;
/** Partidos con observaciones necesarios para analizar. */
export const MIN_OBSERVED = 3;

export function detectPatterns(matches: Match[]): { patterns: Pattern[]; observed: number } {
  const withText = matches.filter((m) => !m.deleted_at && observationText(m)).sort(compareDateDesc);
  const observed = withText.length;
  const acc = new Map<string, { def: PatternDef; ids: Set<string>; tones: Record<Tone, number>; examples: PatternExample[] }>();

  for (const m of withText) {
    const sentences = observationText(m).split(/[.!?\n;]+/).map((s) => s.trim()).filter(Boolean);
    for (const raw of sentences) {
      const s = norm(raw);
      for (const def of DEFS) {
        if (!def.re.test(s)) continue;
        const a = acc.get(def.id) ?? { def, ids: new Set<string>(), tones: { negativo: 0, positivo: 0, neutro: 0 }, examples: [] };
        a.tones[tone(s)]++;
        if (!a.ids.has(m.id)) a.ids.add(m.id);
        if (a.examples.length < 3 && !a.examples.some((e) => e.matchId === m.id)) {
          a.examples.push({ matchId: m.id, rival: m.rival, date: m.date, text: raw.length > 140 ? raw.slice(0, 137) + '…' : raw });
        }
        acc.set(def.id, a);
      }
    }
  }

  const patterns: Pattern[] = [...acc.values()]
    .filter((a) => a.ids.size >= MIN_PATTERN_MATCHES)
    .map((a) => {
      const t = a.tones;
      const tn: Tone = t.negativo > t.positivo && t.negativo >= t.neutro / 2 ? 'negativo' : t.positivo > t.negativo && t.positivo >= t.neutro / 2 ? 'positivo' : 'neutro';
      return { id: a.def.id, label: a.def.label, area: a.def.area, matches: a.ids.size, observed, tone: tn, examples: a.examples };
    })
    .sort((a, b) => b.matches - a.matches || (a.tone === 'negativo' ? -1 : 1));
  return { patterns, observed };
}
