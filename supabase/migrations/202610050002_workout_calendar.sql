create table public.gym_workout_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  items jsonb not null default '[]'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key(user_id,day),
  constraint gym_day_items check (jsonb_typeof(items)='array' and octet_length(items::text)<=1048576)
);
alter table public.gym_workout_days enable row level security;
revoke all on public.gym_workout_days from anon,authenticated;
grant select on public.gym_workout_days to authenticated;
grant all on public.gym_workout_days to service_role;
create policy gym_read_own_days on public.gym_workout_days for select to authenticated using ((select auth.uid())=user_id);

-- Compare revisions on the server so one device cannot silently overwrite another.
create function public.gym_save_workout_day(p_day date,p_items jsonb,p_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare player uuid; saved public.gym_workout_days; accepted boolean;
begin
  player := auth.uid();
  if player is null then raise exception 'Sign in to save workouts'; end if;
  if p_day is null or p_revision is null or p_revision<0 or p_items is null or jsonb_typeof(p_items)<>'array' or octet_length(p_items::text)>1048576 then raise exception 'Invalid workout day'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x)<>'object' or coalesce(x->>'id','')='' or jsonb_typeof(x->'done') is distinct from 'boolean') then raise exception 'Invalid workout entries'; end if;
  if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct x->>'id') from jsonb_array_elements(p_items) x) then raise exception 'Duplicate workout entries'; end if;
  if p_revision=0 then
    insert into public.gym_workout_days(user_id,day,items) values(player,p_day,p_items)
    on conflict(user_id,day) do nothing returning * into saved;
  else
    update public.gym_workout_days set items=p_items,revision=revision+1,updated_at=now()
    where user_id=player and day=p_day and revision=p_revision returning * into saved;
  end if;
  accepted := saved.user_id is not null;
  if not accepted then select * into saved from public.gym_workout_days where user_id=player and day=p_day; end if;
  return jsonb_build_object('accepted',accepted,'day',p_day,'items',coalesce(saved.items,'[]'::jsonb),'revision',coalesce(saved.revision,0));
end;
$$;
revoke all on function public.gym_save_workout_day(date,jsonb,bigint) from public,anon;
grant execute on function public.gym_save_workout_day(date,jsonb,bigint) to authenticated;
