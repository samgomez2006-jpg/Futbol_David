-- Mi Equipo FC — esquema inicial
-- Todo cuelga de un equipo (teams). Los entrenadores acceden vía team_members y RLS.
-- Los IDs son UUID generados en el cliente para permitir trabajo offline (outbox) sin colisiones.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  season      text not null default '' check (char_length(season) <= 20),
  category    text not null default '' check (char_length(category) <= 60),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.team_members (
  team_id    uuid not null references public.teams (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'coach' check (role in ('owner', 'coach')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

create table public.players (
  id          uuid primary key,
  team_id     uuid not null references public.teams (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  number      smallint check (number between 0 and 99),
  position    text not null check (position in ('Portero', 'Defensa', 'Centrocampista', 'Delantero')),
  birth       date,
  foot        text not null default 'D' check (foot in ('D', 'I', 'A')),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index players_team_idx on public.players (team_id);

create table public.matches (
  id          uuid primary key,
  team_id     uuid not null references public.teams (id) on delete cascade,
  rival       text not null check (char_length(rival) between 1 and 80),
  date        date not null,
  venue       text not null default 'L' check (venue in ('L', 'V')),
  gf          smallint not null default 0 check (gf between 0 and 99),
  ga          smallint not null default 0 check (ga between 0 and 99),
  total_mins  smallint not null default 60 check (total_mins between 1 and 150),
  tactic      text not null default '' check (char_length(tactic) <= 20),
  notes       text not null default '' check (char_length(notes) <= 4000),
  motm        uuid,
  -- Agregados del partido: se guardan de forma atómica con el partido.
  goals       jsonb not null default '[]' check (jsonb_typeof(goals) = 'array'),
  conceded    jsonb not null default '[]' check (jsonb_typeof(conceded) = 'array'),
  cards       jsonb not null default '[]' check (jsonb_typeof(cards) = 'array'),
  lineup      jsonb not null default '[]' check (jsonb_typeof(lineup) = 'array'),
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index matches_team_idx on public.matches (team_id, date desc);

create table public.trainings (
  id         uuid primary key,
  team_id    uuid not null references public.teams (id) on delete cascade,
  date       date not null,
  notes      text not null default '' check (char_length(notes) <= 2000),
  present    uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trainings_team_idx on public.trainings (team_id, date desc);

create table public.evaluations (
  id         uuid primary key,
  team_id    uuid not null references public.teams (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  date       date not null,
  skills     jsonb not null default '{}' check (jsonb_typeof(skills) = 'object'),
  notes      text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index evaluations_team_idx on public.evaluations (team_id);
create index evaluations_player_idx on public.evaluations (player_id);

create table public.objectives (
  id         uuid primary key,
  team_id    uuid not null references public.teams (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  scope      text not null default 'team' check (scope in ('team', 'player')),
  player_id  uuid references public.players (id) on delete cascade,
  category   text not null,
  target     integer not null default 1 check (target > 0),
  current    integer not null default 0 check (current >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope = 'team' or player_id is not null)
);
create index objectives_team_idx on public.objectives (team_id);
create index objectives_player_idx on public.objectives (player_id);

create table public.callups (
  id         uuid primary key,
  team_id    uuid not null references public.teams (id) on delete cascade,
  rival      text not null check (char_length(rival) between 1 and 80),
  date       date not null,
  meet_time  text not null default '' check (char_length(meet_time) <= 40),
  place      text not null default '' check (char_length(place) <= 120),
  players    jsonb not null default '[]' check (jsonb_typeof(players) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index callups_team_idx on public.callups (team_id, date desc);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['teams','players','matches','trainings','evaluations','objectives','callups'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers de seguridad
-- ---------------------------------------------------------------------------
create or replace function public.is_team_member(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = tid and m.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_team_member(uuid) from public, anon;
grant execute on function public.is_team_member(uuid) to authenticated;

-- Crea un equipo (con id opcional elegido por el cliente para subir datos locales) y
-- da de alta al usuario como propietario. Devuelve el equipo.
create or replace function public.create_team(p_name text, p_season text default '', p_category text default '', p_id uuid default null)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t public.teams;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.teams (id, name, season, category, created_by)
  values (coalesce(p_id, gen_random_uuid()), coalesce(nullif(trim(p_name), ''), 'Mi Equipo FC'), coalesce(p_season, ''), coalesce(p_category, ''), uid)
  returning * into t;
  insert into public.team_members (team_id, user_id, role) values (t.id, uid, 'owner');
  return t;
end;
$$;
revoke all on function public.create_team(text, text, text, uuid) from public, anon;
grant execute on function public.create_team(text, text, text, uuid) to authenticated;

-- Unirse a un equipo existente con su código de invitación (cuerpo técnico).
create or replace function public.join_team(p_code text)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t public.teams;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into t from public.teams where invite_code = upper(trim(p_code));
  if not found then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;
  insert into public.team_members (team_id, user_id, role) values (t.id, uid, 'coach')
  on conflict do nothing;
  return t;
end;
$$;
revoke all on function public.join_team(text) from public, anon;
grant execute on function public.join_team(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy teams_select on public.teams for select to authenticated
  using (public.is_team_member(id));
create policy teams_update on public.teams for update to authenticated
  using (public.is_team_member(id)) with check (public.is_team_member(id));
create policy teams_delete on public.teams for delete to authenticated
  using (exists (select 1 from public.team_members m where m.team_id = id and m.user_id = (select auth.uid()) and m.role = 'owner'));

create policy members_select on public.team_members for select to authenticated
  using (public.is_team_member(team_id));
create policy members_leave on public.team_members for delete to authenticated
  using (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['players','matches','trainings','evaluations','objectives','callups'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_all on public.%I for all to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id))', t, t);
  end loop;
end $$;

-- La API anónima no necesita acceso a nada.
revoke all on all tables in schema public from anon;
