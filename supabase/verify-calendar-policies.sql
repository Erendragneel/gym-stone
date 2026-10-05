begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
('ef1f8b89-3e53-4c21-9ef6-310d58fb0001','authenticated','authenticated','gym-qa-one@example.invalid','{"gym_username":"qa_calendar_one_20261005"}'),
('ef1f8b89-3e53-4c21-9ef6-310d58fb0002','authenticated','authenticated','gym-qa-two@example.invalid','{"gym_username":"qa_calendar_two_20261005"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','ef1f8b89-3e53-4c21-9ef6-310d58fb0001',true);
do $test$
declare result jsonb;
begin
  result:=public.gym_save_workout_day('2026-10-05','[{"id":"squat","done":false}]',0);
  if result->>'accepted'<>'true' or result->>'revision'<>'1' then raise exception 'Initial save failed'; end if;
  result:=public.gym_save_workout_day('2026-10-05','[{"id":"squat","done":true,"minutes":30}]',1);
  if result->>'accepted'<>'true' or result->>'revision'<>'2' then raise exception 'Revision save failed'; end if;
  result:=public.gym_save_workout_day('2026-10-05','[]',1);
  if result->>'accepted'<>'false' or result->>'revision'<>'2' or jsonb_array_length(result->'items')<>1 then raise exception 'Stale write overwrote workouts'; end if;
  result:=public.gym_save_workout_day('2026-10-05','[]',0);
  if result->>'accepted'<>'false' then raise exception 'Insert overwrote workouts'; end if;
  begin
    perform public.gym_save_workout_day('2026-10-05','[{"id":"squat","done":true},{"id":"squat","done":false}]',2);
    raise exception 'Duplicate accepted';
  exception when raise_exception then if sqlerrm<>'Duplicate workout entries' then raise; end if; end;
  begin
    update public.gym_workout_days set items='[]';
    raise exception 'Direct writes allowed';
  exception when insufficient_privilege then null; end;
end;
$test$;
select set_config('request.jwt.claim.sub','ef1f8b89-3e53-4c21-9ef6-310d58fb0002',true);
do $test$
begin
  if (select count(*) from public.gym_workout_days)<>0 then raise exception 'Another player workouts exposed'; end if;
  if public.gym_save_workout_day('2026-10-05','[]',0)->>'revision'<>'1' then raise exception 'Separate player save failed'; end if;
end;
$test$;
set local role anon;
do $test$
begin
  begin perform count(*) from public.gym_workout_days;raise exception 'Anonymous read allowed';exception when insufficient_privilege then null;end;
  begin perform public.gym_save_workout_day('2026-10-05','[]',0);raise exception 'Anonymous write allowed';exception when insufficient_privilege then null;end;
end;
$test$;
rollback;
