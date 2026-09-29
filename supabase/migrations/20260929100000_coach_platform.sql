-- Plataforma completa para entrenadores:
--  · perfil del equipo (modelo de juego, cuerpo técnico…)
--  · ficha de partido completa (competición, estado, convocatoria vinculada, cambios, incidencias, rival, planteamiento)
--  · jugadas / ejercicios de la pizarra táctica

alter table public.teams
  add column profile jsonb not null default '{}' check (jsonb_typeof(profile) = 'object');

alter table public.matches
  add column competition text not null default '' check (char_length(competition) <= 80),
  add column status      text not null default 'played' check (status in ('scheduled', 'played')),
  add column callup_id   uuid references public.callups (id) on delete set null,
  add column subs        jsonb not null default '[]' check (jsonb_typeof(subs) = 'array'),
  add column incidents   jsonb not null default '[]' check (jsonb_typeof(incidents) = 'array'),
  add column rival_info  jsonb not null default '{}' check (jsonb_typeof(rival_info) = 'object'),
  add column plan        jsonb not null default '{}' check (jsonb_typeof(plan) = 'object');
create index matches_callup_idx on public.matches (callup_id);

create table public.plays (
  id          uuid primary key,
  team_id     uuid not null references public.teams (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  kind        text not null default 'jugada' check (kind in ('jugada', 'ejercicio', 'situacion')),
  description text not null default '' check (char_length(description) <= 4000),
  data        jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index plays_team_idx on public.plays (team_id, updated_at desc);

create trigger plays_touch before update on public.plays
  for each row execute function public.touch_updated_at();

alter table public.plays enable row level security;
create policy plays_all on public.plays for all to authenticated
  using (private.is_team_member(team_id)) with check (private.is_team_member(team_id));

revoke all on public.plays from anon;
