-- Local migrated database only. All fixtures roll back.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/venue_profile_editing.sql
\set ON_ERROR_STOP on
begin;
create schema vp_test;
create function vp_test.ok(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
create function vp_test.run(uid uuid, statement text, admin boolean default false, client text default 'authenticated') returns jsonb language plpgsql as $$
declare result jsonb;
begin
 perform set_config('request.jwt.claims', jsonb_build_object('sub',uid,'role',client,'app_metadata',jsonb_build_object('role',case when admin then 'admin' else 'user' end))::text,true);
 execute format('set local role %I',client);
 execute statement into result;
 reset role;
 return result;
end $$;
create function vp_test.fails(uid uuid, statement text, expected text, message text default null) returns void language plpgsql as $$
declare s text; m text;
begin
 begin perform vp_test.run(uid,statement);
 exception when others then
  get stacked diagnostics s=returned_sqlstate,m=message_text;
  if s=expected and (message is null or m=message) then return; end if;
  raise exception 'Unexpected failure: % %',s,m;
 end;
 raise exception 'Expected failure % for %',expected,statement;
end $$;
do $$
declare owner_u uuid:=gen_random_uuid(); manager_u uuid:=gen_random_uuid(); editor_u uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
 venue uuid:=gen_random_uuid(); archived uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); keep uuid:=gen_random_uuid();
 tag text:=gen_random_uuid()::text; row jsonb; keys text[]; image text; who uuid;
begin
 insert into auth.users(id,email,email_confirmed_at) select u,u||'@example.test',now() from unnest(array[owner_u,manager_u,editor_u,stranger]) u;
 insert into public.venues(id,name,slug,city,status,phone,address_line2,postal_code) values
 (venue,'Venue Contract','vp-'||tag,'boston','active','secret-phone','secret-suite','secret-postal'),
 (archived,'Archived Venue','va-'||tag,'boston','archived',null,null,null),
 (other,'Duplicate Venue','vd-'||tag,'boston','active',null,null,null),
 (keep,'Surviving Venue','vk-'||tag,'boston','active',null,null,null);
 insert into public.entity_members(entity_kind,entity_id,user_id,member_role) values
 ('venue',venue,owner_u,'owner'),('venue',venue,manager_u,'manager'),('venue',venue,editor_u,'editor'),('venue',archived,manager_u,'manager');
 foreach who in array array[owner_u,manager_u] loop
  perform vp_test.run(who,format('select to_jsonb(public.entity_profile_save(%L,%L,%L::jsonb))','venue',venue,'{"description":"Latin nights since 1998","image_url":"https://img.example/club.jpg"}'));
  perform vp_test.ok((select description='Latin nights since 1998' and image_url='https://img.example/club.jpg' from public.venues where id=venue),'owner/manager writes');
 end loop;
 perform vp_test.fails(editor_u,format('select to_jsonb(public.entity_profile_save(%L,%L,%L::jsonb))','venue',venue,'{}'),'42501');
 perform vp_test.fails(stranger,format('select to_jsonb(public.entity_profile_save(%L,%L,%L::jsonb))','venue',venue,'{}'),'42501');
 perform vp_test.fails(manager_u,format('select to_jsonb(public.entity_profile_save(%L,%L,%L::jsonb))','venue',archived,'{}'),'42501');
 perform vp_test.fails(owner_u,format('select to_jsonb(public.entity_profile_save(%L,%L,%L::jsonb))','venue',venue,'{"name":"Other"}'),'22023','Field name cannot be edited here');
 foreach image in array array['http://img.example/a.jpg','javascript:alert(1)','data:image/png;base64,AAAA','https://img.example/a b.jpg','https://'||repeat('x',2041)] loop
  perform vp_test.fails(manager_u,format('select to_jsonb(public.entity_profile_save(%L,%L,%L::jsonb))','venue',venue,jsonb_build_object('image_url',image)),'22023','Image link must be a full https:// link.');
 end loop;
 perform vp_test.run(manager_u,format('select to_jsonb(public.entity_profile_save(%L,%L,%L::jsonb))','venue',venue,jsonb_build_object('description',repeat('x',1200))));
 perform vp_test.ok((select length(description)=1200 from public.venues where id=venue),'1200 boundary');
 perform vp_test.fails(manager_u,format('select to_jsonb(public.entity_profile_save(%L,%L,%L::jsonb))','venue',venue,jsonb_build_object('description',repeat('x',1201))),'22023','Description must be 1,200 characters or fewer.');
 perform vp_test.run(manager_u,format('select to_jsonb(public.entity_profile_save(%L,%L,%L::jsonb))','venue',venue,'{"description":"   ","image_url":""}'));
 perform vp_test.ok((select description is null and image_url is null from public.venues where id=venue),'blank clears');
 begin update public.venues set image_url='http://x.example/a.jpg' where id=venue; raise exception 'constraint did not reject'; exception when check_violation then null; end;
 begin update public.venues set description=repeat('x',1201) where id=venue; raise exception 'length constraint did not reject'; exception when check_violation then null; end;
 perform vp_test.run(manager_u,format('select to_jsonb(public.entity_profile_save(%L,%L,%L::jsonb))','venue',venue,'{"description":"<b>Literal text</b>","image_url":"https://img.example/club.jpg"}'));
 row:=vp_test.run(manager_u,format('select public.entity_workspace(%L,%L)','venue',venue))->'entity';
 perform vp_test.ok(row->>'description'='<b>Literal text</b>' and row->>'image_url'='https://img.example/club.jpg','workspace projection');
 row:=vp_test.run(null,format('select public.public_entity_detail(%L,%L)','venue','vp-'||tag),false,'anon')->'entity';
 select array_agg(k order by k) into keys from jsonb_object_keys(row) k;
 perform vp_test.ok(keys=(select array_agg(k order by k) from unnest(array['kind','id','name','slug','description','image_url','city','state_region','country','address','website','instagram','origin','category']) k),'public exact keys');
 perform vp_test.ok(row->>'description'='<b>Literal text</b>' and row->>'image_url'='https://img.example/club.jpg','public values');
 row:=public.flyer_public_entity_json('venue',venue);
 select array_agg(k order by k) into keys from jsonb_object_keys(row) k;
 perform vp_test.ok(keys=(select array_agg(k order by k) from unnest(array['id','name','slug','address','city','state_region','country','website','instagram','status','origin']) k),'flyer exact keys');
 perform vp_test.ok(not has_table_privilege('anon','public.venues','select'),'no anonymous table access');
 update public.venues set description='Merged description',image_url='https://img.example/merged.jpg' where id=other;
 perform vp_test.run(owner_u,format('select to_jsonb(public.merge_venues(%L,%L))',keep,other),true);
 perform vp_test.ok((select description='Merged description' and image_url='https://img.example/merged.jpg' from public.venues where id=keep),'merge fills nulls');
 update public.venues set status='active',description='Discarded description',image_url='https://img.example/discarded.jpg' where id=other;
 perform vp_test.run(owner_u,format('select to_jsonb(public.merge_venues(%L,%L))',keep,other),true);
 perform vp_test.ok((select description='Merged description' and image_url='https://img.example/merged.jpg' from public.venues where id=keep),'merge preserves survivor');
end $$;
rollback;
