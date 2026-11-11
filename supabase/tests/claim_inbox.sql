-- Disposable migrated database only. Fixture changes roll back.
\set ON_ERROR_STOP on
begin;
create schema ci_test;
create function ci_test.ok(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAILED: %', label; end if; end $$;
create function ci_test.mine(uid uuid) returns jsonb language plpgsql as $$
declare result jsonb;
begin
 perform set_config('request.jwt.claims', jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 set local role authenticated;
 select public.my_entity_claims() into result;
 reset role;
 return result;
end $$;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); listing uuid := gen_random_uuid();
 ca uuid := gen_random_uuid(); cb uuid := gen_random_uuid(); tag text := gen_random_uuid()::text; rows jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values (a,a||'@example.test',now()),(b,b||'@example.test',now());
 insert into public.schools(id,name,slug,status,city) values (listing,'Inbox School','inbox-'||tag,'active','Boston');
 insert into public.entity_claims(id,entity_kind,entity_id,user_id,relationship,status,review_note,created_at) values
 (ca,'school',listing,a,'owner','approved','Literal <b>note</b>',now()),
 (cb,'school',listing,b,'staff','rejected','Other claimant note',now()-interval '1 day');
 insert into public.entity_members(entity_kind,entity_id,user_id,member_role) values ('school',listing,a,'owner');
 rows := ci_test.mine(a);
 perform ci_test.ok(jsonb_array_length(rows)=1 and rows->0->>'id'=ca::text,'claimant isolation');
 perform ci_test.ok(rows->0->>'listing_status'='active','listing status');
 perform ci_test.ok(rows->0->>'workspace_role'='owner','approved membership');
 perform ci_test.ok(rows->0->>'review_note'='Literal <b>note</b>','note preservation');
 perform ci_test.ok((rows->0) ?& array['id','kind','entity_id','name','slug','relationship','status','review_note','created_at','reviewed_at'],'existing keys');
 rows := ci_test.mine(b);
 perform ci_test.ok(jsonb_array_length(rows)=1 and rows->0->>'id'=cb::text and rows->0->>'workspace_role' is null,'other claimant isolation');
 update public.entity_members set status='removed' where user_id=a;
 perform ci_test.ok(ci_test.mine(a)->0->>'workspace_role' is null,'removed membership');
 update public.schools set status='archived' where id=listing;
 rows := ci_test.mine(a);
 perform ci_test.ok(rows->0->>'listing_status'='archived' and rows->0->>'workspace_role' is null,'archived listing');
 update public.schools set status='active' where id=listing;
 update public.entity_members set status='active' where user_id=a;
 update public.profiles set status='suspended' where id=a;
 rows := ci_test.mine(a);
 perform ci_test.ok(jsonb_array_length(rows)=1 and rows->0->>'id'=ca::text and rows->0->>'workspace_role' is null,'inactive claimant isolation');
 begin
  set local role anon;
  perform public.my_entity_claims();
  raise exception 'Anonymous execution succeeded';
 exception when insufficient_privilege then reset role;
 end;
end $$;
rollback;
