-- El helper de RLS no debe estar expuesto por la API REST (/rpc): lo movemos a un esquema privado.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_team_member(tid uuid)
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
revoke all on function private.is_team_member(uuid) from public, anon;
grant execute on function private.is_team_member(uuid) to authenticated;

alter policy teams_select on public.teams using (private.is_team_member(id));
alter policy teams_update on public.teams using (private.is_team_member(id)) with check (private.is_team_member(id));
alter policy members_select on public.team_members using (private.is_team_member(team_id));

do $$
declare t text;
begin
  foreach t in array array['players','matches','trainings','evaluations','objectives','callups'] loop
    execute format('alter policy %I_all on public.%I using (private.is_team_member(team_id)) with check (private.is_team_member(team_id))', t, t);
  end loop;
end $$;

drop function public.is_team_member(uuid);

create index teams_created_by_idx on public.teams (created_by);
