-- Dedicated Gym Stone project. Passwords are owned by Supabase Auth.
create table public.gym_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  profile jsonb,
  updated_at timestamptz not null default now(),
  constraint gym_profile_size check (profile is null or (jsonb_typeof(profile) = 'object' and octet_length(profile::text) <= 16384))
);
create unique index gym_players_username_key on public.gym_players (lower(username));
alter table public.gym_players enable row level security;
revoke all on public.gym_players from anon, authenticated;
grant all on public.gym_players to service_role;
grant select on public.gym_players to authenticated;
grant update (profile) on public.gym_players to authenticated;
create policy gym_read_own_player on public.gym_players for select to authenticated using ((select auth.uid()) = user_id);
create policy gym_update_own_player on public.gym_players for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.gym_create_player() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.gym_players(user_id,username) values(new.id,new.raw_user_meta_data->>'gym_username');
  return new;
end;
$$;
revoke all on function public.gym_create_player() from public, anon, authenticated;
create trigger gym_auth_player_created after insert on auth.users for each row execute function public.gym_create_player();

create function public.gym_validate_profile() returns trigger language plpgsql set search_path = '' as $$
declare p jsonb; birth date; weight numeric; days numeric; minutes numeric; hours numeric;
begin
  if new.user_id <> old.user_id or new.username <> old.username then raise exception 'Player identity cannot be changed'; end if;
  p := new.profile;
  if p is not null then
    if jsonb_typeof(p) <> 'object' or octet_length(p::text) > 16384 then raise exception 'Invalid profile'; end if;
    if coalesce(p->>'gender','') not in ('male','female') or coalesce(p->>'birthday','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p->>'weightUnit','') not in ('kg','lb') then raise exception 'Invalid profile fields'; end if;
    birth := (p->>'birthday')::date;
    if birth > current_date or birth < (current_date - interval '121 years')::date then raise exception 'Invalid birthday'; end if;
    weight := (p->>'weight')::numeric; days := (p->>'daysPerWeek')::numeric;
    if weight is null or weight < 1 or weight > 1500 or days is null or days < 1 or days > 7 or days <> trunc(days) then raise exception 'Invalid weight or weekly goal'; end if;
    if p->>'targetWeight' is not null and ((p->>'targetWeight')::numeric < 1 or (p->>'targetWeight')::numeric > 1500) then raise exception 'Invalid goal weight'; end if;
    minutes := (p->>'minutesPerWorkout')::numeric; hours := (p->>'hoursPerWeek')::numeric;
    if minutes is not null and (minutes < 5 or minutes > 180) then raise exception 'Invalid workout time goal'; end if;
    if hours is not null and (hours < 0.5 or hours > 30) then raise exception 'Invalid weekly time goal'; end if;
    if coalesce(p->>'goal','') not in ('stay-active','strength','endurance','mobility','weight-management') then raise exception 'Invalid training goal'; end if;
    new.profile := jsonb_set(p,'{name}',to_jsonb(new.username));
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger gym_player_updated before update on public.gym_players for each row execute function public.gym_validate_profile();

-- Used only by the username sign-in Edge Function, never readable from the app.
create table public.gym_login_limits (bucket text primary key, window_start timestamptz not null, attempts integer not null);
alter table public.gym_login_limits enable row level security;
revoke all on public.gym_login_limits from anon, authenticated;
grant all on public.gym_login_limits to service_role;
create function public.gym_consume_login_attempt(p_bucket text,p_limit integer) returns boolean language plpgsql security definer set search_path = '' as $$
declare count_attempts integer;
begin
  insert into public.gym_login_limits(bucket,window_start,attempts) values(p_bucket,date_trunc('minute',now()),1)
  on conflict(bucket) do update set
    attempts = case when gym_login_limits.window_start < date_trunc('minute',now()) then 1 else gym_login_limits.attempts+1 end,
    window_start = date_trunc('minute',now()) returning attempts into count_attempts;
  delete from public.gym_login_limits where window_start < now()-interval '1 day';
  return count_attempts <= least(greatest(p_limit,1),100);
end;
$$;
revoke all on function public.gym_consume_login_attempt(text,integer) from public, anon, authenticated;
grant execute on function public.gym_consume_login_attempt(text,integer) to service_role;

create function public.gym_resolve_username(p_username text) returns uuid language sql security definer set search_path = '' as $$
  select user_id from public.gym_players where lower(username) = lower(p_username) limit 1;
$$;
revoke all on function public.gym_resolve_username(text) from public, anon, authenticated;
grant execute on function public.gym_resolve_username(text) to service_role;
