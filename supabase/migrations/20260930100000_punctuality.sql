-- Puntualidad: estado por jugador en cada entreno (puntual / tarde / falta, minutos de retraso, hora de llegada y observación).
-- `present` se mantiene (asistentes = puntuales + tarde) por compatibilidad; los entrenos antiguos se leen como «todos puntuales».
-- Las convocatorias ya guardan sus jugadores en JSONB: la llegada va dentro de cada entrada (campo `arrival`), sin cambios de esquema.
alter table public.trainings
  add column if not exists attendance jsonb not null default '[]' check (jsonb_typeof(attendance) = 'array');
