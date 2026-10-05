begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data)
values
('ef1f8b89-3e53-4c21-9ef6-310d58fb0001','authenticated','authenticated','gym-qa-one@example.invalid','{"gym_username":"qa_rls_one_20261005"}'),
('ef1f8b89-3e53-4c21-9ef6-310d58fb0002','authenticated','authenticated','gym-qa-two@example.invalid','{"gym_username":"qa_rls_two_20261005"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','ef1f8b89-3e53-4c21-9ef6-310d58fb0001',true);
do $test$
declare n integer;
begin
  select count(*) into n from public.gym_players;
  if n<>1 then raise exception 'RLS exposed another player'; end if;
  update public.gym_players set profile='{"name":"spoofed","gender":"female","birthday":"1996-10-05","weight":70,"weightUnit":"kg","targetWeight":null,"goal":"strength","daysPerWeek":7,"minutesPerWorkout":45,"hoursPerWeek":4.5,"completed":true,"updatedAt":1791180000000}' where user_id='ef1f8b89-3e53-4c21-9ef6-310d58fb0001';
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Own profile update failed'; end if;
  if (select profile->>'name' from public.gym_players)<>'qa_rls_one_20261005' then raise exception 'Username spoof accepted'; end if;
  update public.gym_players set profile=null where user_id='ef1f8b89-3e53-4c21-9ef6-310d58fb0002';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Another player profile changed'; end if;
  begin
    update public.gym_players set profile=jsonb_set(profile,'{daysPerWeek}','8');
    raise exception 'Invalid frequency accepted';
  exception when raise_exception then
    if sqlerrm<>'Invalid weight or weekly goal' then raise; end if;
  end;
  begin
    update public.gym_players set profile=jsonb_set(profile,'{weight}','0');
    raise exception 'Invalid weight accepted';
  exception when raise_exception then
    if sqlerrm<>'Invalid weight or weekly goal' then raise; end if;
  end;
  begin
    update public.gym_players set profile=jsonb_set(profile,'{birthday}','"2099-01-01"');
    raise exception 'Future birthday accepted';
  exception when raise_exception then
    if sqlerrm<>'Invalid birthday' then raise; end if;
  end;
end;
$test$;
set local role anon;
do $test$
begin
  begin
    perform count(*) from public.gym_players;
    raise exception 'Anonymous profile access allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.gym_resolve_username('qa_rls_one_20261005');
    raise exception 'Anonymous username resolver allowed';
  exception when insufficient_privilege then null;
  end;
end;
$test$;
rollback;
