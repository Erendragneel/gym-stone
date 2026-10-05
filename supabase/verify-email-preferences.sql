begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
('ef1f8b89-3e53-4c21-9ef6-310d58fb0001','authenticated','authenticated','gym-qa-one@example.invalid','{"gym_username":"qa_email_one_20261005"}'),
('ef1f8b89-3e53-4c21-9ef6-310d58fb0002','authenticated','authenticated','gym-qa-two@example.invalid','{"gym_username":"qa_email_two_20261005"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','ef1f8b89-3e53-4c21-9ef6-310d58fb0001',true);
do $test$
declare result jsonb;
begin
  result:=public.gym_save_email_preferences(true,array[4,2,2],'08:30','America/New_York');
  if result->'days'<>'[2,4]'::jsonb or result->>'enabled'<>'true' then raise exception 'Preference save failed'; end if;
  begin perform public.gym_save_email_preferences(true,array[]::integer[],'08:30','UTC');raise exception 'Empty days accepted';exception when raise_exception then if sqlerrm<>'Choose valid reminder days' then raise; end if;end;
  begin perform public.gym_save_email_preferences(true,array[7],'08:30','UTC');raise exception 'Invalid days accepted';exception when raise_exception then if sqlerrm<>'Choose valid reminder days' then raise; end if;end;
  begin perform public.gym_save_email_preferences(true,array[2],'24:00','UTC');raise exception 'Invalid time accepted';exception when raise_exception then if sqlerrm<>'Choose a valid reminder time' then raise; end if;end;
  begin perform public.gym_save_email_preferences(true,array[2],'08:30','Fake/Zone');raise exception 'Invalid zone accepted';exception when raise_exception then if sqlerrm<>'Choose a valid time zone' then raise; end if;end;
  begin update public.gym_email_preferences set enabled=false;raise exception 'Direct write allowed';exception when insufficient_privilege then null;end;
end;
$test$;
select set_config('request.jwt.claim.sub','ef1f8b89-3e53-4c21-9ef6-310d58fb0002',true);
do $test$
begin if (select count(*) from public.gym_email_preferences)<>0 then raise exception 'Other player preferences exposed';end if;end;
$test$;
set local role anon;
do $test$
begin
  begin perform count(*) from public.gym_email_preferences;raise exception 'Anonymous read allowed';exception when insufficient_privilege then null;end;
  begin perform public.gym_save_email_preferences(false,array[]::integer[],'08:30','UTC');raise exception 'Anonymous save allowed';exception when insufficient_privilege then null;end;
end;
$test$;
rollback;
