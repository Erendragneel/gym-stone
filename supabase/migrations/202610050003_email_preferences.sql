create table public.gym_email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  days integer[] not null default array[1,3,5],
  reminder_time time not null default '18:00',
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now(),
  constraint gym_email_days check (cardinality(days)<=7 and days <@ array[0,1,2,3,4,5,6] and (not enabled or cardinality(days)>0))
);
alter table public.gym_email_preferences enable row level security;
revoke all on public.gym_email_preferences from anon,authenticated;
grant select on public.gym_email_preferences to authenticated;
grant all on public.gym_email_preferences to service_role;
create policy gym_read_own_email_preferences on public.gym_email_preferences for select to authenticated using ((select auth.uid())=user_id);

create function public.gym_save_email_preferences(p_enabled boolean,p_days integer[],p_time text,p_timezone text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare player uuid; saved public.gym_email_preferences;
begin
  player:=auth.uid();
  if player is null then raise exception 'Sign in to save notification preferences'; end if;
  if p_enabled is null or p_days is null or cardinality(p_days)>7 or not p_days <@ array[0,1,2,3,4,5,6] or array_position(p_days,null) is not null or (p_enabled and cardinality(p_days)=0) then raise exception 'Choose valid reminder days'; end if;
  if p_time is null or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then raise exception 'Choose a valid reminder time'; end if;
  if p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Choose a valid time zone'; end if;
  insert into public.gym_email_preferences(user_id,enabled,days,reminder_time,timezone)
  values(player,p_enabled,array(select distinct d from unnest(p_days) d order by d),p_time::time,p_timezone)
  on conflict(user_id) do update set enabled=excluded.enabled,days=excluded.days,reminder_time=excluded.reminder_time,timezone=excluded.timezone,updated_at=now()
  returning * into saved;
  return jsonb_build_object('enabled',saved.enabled,'days',saved.days,'reminder_time',saved.reminder_time,'timezone',saved.timezone);
end;
$$;
revoke all on function public.gym_save_email_preferences(boolean,integer[],text,text) from public,anon;
grant execute on function public.gym_save_email_preferences(boolean,integer[],text,text) to authenticated;
