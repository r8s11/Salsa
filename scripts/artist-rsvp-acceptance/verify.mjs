import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { createHmac, randomUUID, createHash } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { pathToFileURL } from 'node:url';
let gateway;

const root=resolve(import.meta.dirname,'../..');
const caseIndex=process.argv.indexOf('--case');
const caseId=caseIndex===-1?'all':process.argv[caseIndex+1];
const serve=process.argv.includes('--serve');
const cases=['U1','U5','U8','U9','U10','U12','F1','F2','F4','F6','F7','F8','F10','R6'];
if (!serve && !cases.includes(caseId) && caseId!=='all') throw Error(`Unknown database case: ${caseId}`);
const temp=await mkdtemp(join(tmpdir(),'artist-rsvp-'));
const bin=execFileSync('pg_config',['--bindir'],{encoding:'utf8'}).trim();
const secret='disposable-artist-rsvp-'+randomUUID();
const children=[]; let started=false;
const port=async()=>{const s=createServer();await new Promise((yes,no)=>s.once('error',no).listen(0,'127.0.0.1',yes));const p=s.address().port;await new Promise(yes=>s.close(yes));return p;};
const pgPort=await port(), apiPort=await port();
const run=(name,args,options={})=>execFileSync(join(bin,name),args,{encoding:'utf8',maxBuffer:8*1024*1024,...options});
const pgEnv={...process.env,PGHOST:'127.0.0.1',PGPORT:String(pgPort),PGUSER:'postgres',PGDATABASE:'postgres'};
const sql=(text)=>run('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{env:pgEnv,input:text}).trim();
const q=v=>`'${String(v).replaceAll("'","''")}'`;
const hash=v=>createHash('sha256').update(v).digest('hex');
function jwt(user,role='authenticated') {const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const head=b({alg:'HS256',typ:'JWT'});const body=b({role,sub:user?.id,app_metadata:{role:user?.platform??'user'},email:user?.email,exp:Math.floor(Date.now()/1000)+86400});const unsigned=`${head}.${body}`;return `${unsigned}.${createHmac('sha256',secret).update(unsigned).digest('base64url')}`;}
const service=jwt(null,'service_role');
async function http(path,token,body,method=body===undefined?'GET':'POST') {
 const response=await fetch(`http://127.0.0.1:${apiPort}/${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{data=text}return {ok:response.ok,status:response.status,data};
}
async function rpc(name,user,args,allowFailure=false){const res=await http(`rpc/${name}`,typeof user==='string'?user:user?jwt(user):null,args);if(!allowFailure)assert.ok(res.ok,`${name}: ${JSON.stringify(res.data)}`);return res.data;}
const ack={admission_payments:true,signup_counts:true,guest_notices:true,version:'2026-11-14'};
const base={title:'Musicality, with intention.',event_type:'workshop',event_types:['class','workshop'],city:'new-york-city',event_date:'2099-12-05T19:00:00Z',event_time:'14:00',price_type:'paid',rsvp_link:'https://artist.example/pay',rsvp_enabled:true,rsvp_limit:30,publication_ack:ack};
let users,artist,otherArtist,organizer;
async function create(payload={},published=true,actor=users.owner){return rpc('artist_event_create',actor,{p_artist_id:artist,p_payload:{...base,...payload},p_publish:published});}
async function submit(event,email,extra={}){return rpc('artist_rsvp_submit',service,{p_event_id:event,p_name:'Guest',p_email:email,p_role:'undecided',p_ip_key:hash(randomUUID()),p_email_key:hash(email.trim().toLowerCase()),...extra});}
const roster=event=>rpc('artist_rsvp_list',users.owner,{p_event_id:event});
const update=(r,changes,actor=users.owner)=>rpc('artist_rsvp_update',actor,{p_rsvp_id:r.id,p_expected_version:r.version,p_changes:changes});
const remove=r=>rpc('artist_rsvp_remove',users.owner,{p_rsvp_id:r.id,p_expected_version:r.version});
async function denied(name,actor,args){const data=await rpc(name,actor,args,true);assert.ok(data?.code,`${name} should deny`);return data;}
const bootstrap=`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator login noinherit;
grant anon,authenticated,service_role to authenticator;
create schema extensions; create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions; create extension pg_trgm with schema extensions; create extension unaccent with schema extensions; create extension citext with schema extensions;
alter database postgres set search_path=public,extensions;
create schema auth; create schema storage;
create table auth.users(id uuid primary key,instance_id uuid,aud text,role text default 'authenticated',email text,encrypted_password text,email_confirmed_at timestamptz,invited_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),last_sign_in_at timestamptz,banned_until timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',confirmation_token text,recovery_token text,email_change text,email_change_token_new text,email_change_token_current text,reauthentication_token text,phone_change text,phone_change_token text,is_sso_user boolean default false,is_anonymous boolean default false,deleted_at timestamptz);
create table auth.identities(id uuid default gen_random_uuid() primary key,provider_id text,user_id uuid references auth.users,provider text,identity_data jsonb,created_at timestamptz,updated_at timestamptz,last_sign_in_at timestamptz);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
create function auth.email() returns text language sql stable as $$ select auth.jwt()->>'email' $$;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text,owner uuid,owner_id text,metadata jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create function storage.filename(name text) returns text language sql immutable as $$ select (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)] $$;
create function storage.extension(name text) returns text language sql immutable as $$ select reverse(split_part(reverse(name),'.',1)) $$;
grant usage on schema public,auth,storage,extensions to anon,authenticated,service_role;
grant execute on all functions in schema auth,storage,extensions to anon,authenticated,service_role;
grant all on all tables in schema auth,storage to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;
alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
`;
async function fixtures(){
 users=Object.fromEntries(['owner','manager','editor','unrelated','organizer','admin','inactive'].map(k=>[k,{id:randomUUID(),email:`${k}@fixture.example`,platform:k==='admin'?'admin':'user'}]));
 for(const [key,u] of Object.entries(users))sql(`insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(${q(u.id)},${q(u.email)},${q(JSON.stringify({role:u.platform}))},'{"display_name":"Fixture User"}'); update public.profiles set onboarding_completed_at=now() where id=${q(u.id)};`);
 sql(`update public.profiles set status='suspended' where id=${q(users.inactive.id)};`);
 artist=sql("insert into public.instructors(name,slug,status,city) values('Ari Rivera','ari-rivera','active','new-york-city') returning id;");
 otherArtist=sql("insert into public.instructors(name,slug,status) values('Other Artist','other-artist','active') returning id;");
 for(const [key,role] of [['owner','owner'],['manager','manager'],['editor','editor'],['inactive','owner']])sql(`insert into public.entity_members(entity_kind,entity_id,user_id,member_role,status) values('instructor',${q(artist)},${q(users[key].id)},${q(role)},'active');`);
 sql(`insert into public.entity_members(entity_kind,entity_id,user_id,member_role,status) values('instructor',${q(otherArtist)},${q(users.unrelated.id)},'owner','active');`);
 organizer=sql("insert into public.organizers(name,status) values('Fixture Organizer','active') returning id;");
 sql(`insert into public.organizer_members(organizer_id,user_id,member_role,status) values(${q(organizer)},${q(users.organizer.id)},'owner','active');`);
}
const checks={
 async U1(){for(const u of [users.owner,users.manager]){const e=await create({},false,u);assert.equal((await http(`public_events?id=eq.${e}`,null)).data.length,0);await rpc('artist_event_update',u,{p_event_id:e,p_payload:{title:'Edited workshop'}});await rpc('artist_event_publish',u,{p_event_id:e,p_ack:ack});const row=JSON.parse(sql(`select row_to_json(e) from public.events e where id=${q(e)}`));assert.equal(row.publication_ack_by,u.id);assert.equal(row.publication_ack_version,ack.version);assert.equal(row.organizer_id,null);assert.equal(sql(`select count(*) from public.event_instructors where event_id=${q(e)} and instructor_id=${q(artist)}`),'1');assert.equal((await http(`public_events?id=eq.${e}`,null)).data.length,1);assert.ok((await rpc('artist_event_list',u,{p_artist_id:artist})).some(x=>x.id===e));}},
 async U5(){const e=await create();await Promise.all(Array.from({length:28},(_,i)=>submit(e,`u5-${i}@fixture.example`)));const s=await rpc('artist_rsvp_summary',null,{p_event_id:e});assert.equal(s.main_list_count,28);assert.equal(s.rsvp_limit,30);assert.equal(s.artist_name,'Ari Rivera');const p=(await http(`public_events?id=eq.${e}`,null)).data[0];assert.equal(p.rsvp_link,null);for(const obj of [s,p])for(const key of ['email','name','rows','confirmed','roles','publication_ack_by'])assert.equal(Object.hasOwn(obj,key),false);const draft=await create({},false);assert.equal(await rpc('artist_rsvp_summary',null,{p_event_id:draft}),null);},
 async U8(){const e=await create({rsvp_limit:1});await submit(e,'u8-main@fixture.example');await submit(e,'u8-wait@fixture.example');let rs=await roster(e);let r=await update(rs.rows.find(x=>x.placement==='main_list'),{confirmed:true});assert.equal(r.contacted,false);r=await update(r,{confirmed:true});assert.equal(sql(`select count(*) from public.artist_rsvp_notifications where event_id=${q(e)} and kind='acceptance'`),'1');await denied('artist_rsvp_update',users.owner,{p_rsvp_id:rs.rows.find(x=>x.placement==='waitlist').id,p_expected_version:1,p_changes:{confirmed:true}});},
 async U9(){const e=await create();await Promise.all(Array.from({length:31},(_,i)=>submit(e,`u9-${i}@fixture.example`)));const rs=await roster(e);assert.equal(rs.totals.main_list,30);assert.equal(rs.totals.waitlist,1);assert.equal(rs.totals.confirmed,0);for(const kind of ['capacity_full','new_waitlist','waitlist_receipt'])assert.equal(sql(`select count(*) from public.artist_rsvp_notifications where event_id=${q(e)} and kind=${q(kind)}`),'1');},
 async U10(){
  const e=await create({rsvp_limit:2});for(let i=0;i<4;i++)await submit(e,`u10-${i}@fixture.example`);
  let rs=await roster(e);await remove(rs.rows.find(x=>x.placement==='main_list'));await submit(e,'u10-new@fixture.example');
  rs=await roster(e);assert.equal(rs.totals.main_list,1);assert.equal(rs.totals.waitlist,3);
  const r=await update(rs.rows.find(x=>x.placement==='waitlist'),{promote:true});assert.equal(r.placement,'main_list');assert.equal(r.confirmed,false);
  assert.equal(sql(`select count(*) from public.artist_rsvp_notifications where event_id=${q(e)} and kind='acceptance'`),'0');
  await denied('artist_event_update',users.owner,{p_event_id:e,p_payload:{rsvp_limit:1}});assert.equal((await roster(e)).totals.main_list,2);
 },
 async U12(){const e=await create({rsvp_limit:1});await submit(e,'u12-main@fixture.example');await submit(e,'u12-wait@fixture.example');let r=await update((await roster(e)).rows.find(x=>x.placement==='main_list'),{confirmed:true});r=await update(r,{confirmed:false});assert.equal(sql(`select count(*) from public.artist_rsvp_notifications where event_id=${q(e)} and kind='withdrawal'`),'1');r=await update(r,{confirmed:true});await rpc('artist_event_update',users.owner,{p_event_id:e,p_payload:{event_date:'2099-12-06T19:00:00Z'}});assert.equal(sql(`select count(*) from public.artist_rsvp_notifications where event_id=${q(e)} and kind='date_update'`),'2');assert.equal((await roster(e)).totals.confirmed,1);await rpc('artist_event_update',users.owner,{p_event_id:e,p_payload:{event_date:'2099-12-06T14:00:00-05:00',event_time:'2 PM'}});assert.equal(sql(`select count(*) from public.artist_rsvp_notifications where event_id=${q(e)} and kind='date_update'`),'2');await rpc('save_event_with_entities',users.admin,{p_event_id:e,p_payload:{event_date:'2099-12-07T19:00:00Z'},p_publish:null});assert.equal(sql(`select count(*) from public.artist_rsvp_notifications where event_id=${q(e)} and kind='date_update'`),'4');sql(`update public.events set status='cancelled' where id=${q(e)};`);assert.equal((await roster(e)).totals.confirmed,0);assert.equal(sql(`select count(*) from public.artist_rsvp_notifications where event_id=${q(e)} and kind='withdrawal'`),'2');},
 async F1(){const e=await create();await submit(e,'private@fixture.example');const r=(await roster(e)).rows[0];for(const u of [null,users.editor,users.unrelated,users.organizer,users.admin,users.inactive]){for(const [name,args] of [['artist_event_get',{p_artist_id:artist,p_event_id:e}],['artist_event_list',{p_artist_id:artist}],['artist_event_update',{p_event_id:e,p_payload:{title:'forged'}}],['artist_rsvp_list',{p_event_id:e}],['artist_rsvp_update',{p_rsvp_id:r.id,p_expected_version:r.version,p_changes:{confirmed:true}}],['artist_rsvp_remove',{p_rsvp_id:r.id,p_expected_version:r.version}]])await denied(name,u,args);for(const table of ['artist_event_rsvps','artist_rsvp_notifications','artist_rsvp_abuse_counters'])assert.equal((await http(table,u?jwt(u):null)).ok,false);}assert.equal((await rpc('artist_rsvp_list',users.manager,{p_event_id:e})).rows[0].email,r.email);},
 async F2(){
  for(const publication_ack of [undefined,{}, {...ack,guest_notices:false},{...ack,version:'old'},{...ack,actor:users.owner.id},{...ack,at:'2099-01-01'}])await denied('artist_event_create',users.owner,{p_artist_id:artist,p_payload:{...base,publication_ack},p_publish:true});
  for(const change of [{rsvp_enabled:false},{rsvp_enabled:'true'},{rsvp_closed:null},{rsvp_limit:'30'},{rsvp_link:'javascript:alert(1)'},{rsvp_link:'https://user:pass@artist.example/'},{organizer_id:organizer},{artist_id:otherArtist},{source_type:'admin'},{recurrence:'weekly'},{series_id:randomUUID()}])await denied('artist_event_create',users.owner,{p_artist_id:artist,p_payload:{...base,...change},p_publish:true});
  const draft=await create({},false);
  for(const payload of [{artist_id:otherArtist},{recurrence:null},{rsvp_enabled:'true'},{rsvp_limit:1.5}])await denied('artist_event_update',users.owner,{p_event_id:draft,p_payload:payload});
  const orgDraft=await rpc('organizer_create_event',users.organizer,{p_organizer_id:organizer,p_payload:{title:'Old client draft',event_type:'social',city:'boston',event_date:base.event_date},p_publish:false});
  const old=await http('rpc/organizer_publish_event',jwt(users.organizer),{p_event_id:orgDraft});assert.equal(old.ok,false);assert.equal(old.status,404);
  assert.equal(sql(`select status from public.events where id=${q(orgDraft)}`),'draft');
  const unavailable=await create();await rpc('artist_event_update',users.owner,{p_event_id:unavailable,p_payload:{rsvp_closed:true}});assert.deepEqual(await submit(unavailable,'closed@fixture.example'),{status:'unavailable'});
  assert.deepEqual(await submit(draft,'draft@fixture.example'),{status:'unavailable'});
  const past=await create({event_date:'2000-01-01T19:00:00Z'});assert.deepEqual(await submit(past,'past@fixture.example'),{status:'unavailable'});
  const disabled=await create({event_type:'social',event_types:['social'],rsvp_enabled:false});assert.deepEqual(await submit(disabled,'disabled@fixture.example'),{status:'unavailable'});
  const inactive=await create();sql(`update public.instructors set status='needs_review' where id=${q(artist)}`);try{assert.deepEqual(await submit(inactive,'inactive@fixture.example'),{status:'unavailable'});}finally{sql(`update public.instructors set status='active' where id=${q(artist)}`);}
 },
 async F4(){const e=await create();const first=await submit(e,'dedupe@fixture.example');let r=await update((await roster(e)).rows[0],{name:'Original',contacted:true,confirmed:true});const replies=await Promise.all([' DEDUPE@fixture.example ','dedupe@FIXTURE.example'].map(email=>submit(e,email,{p_name:'Overwrite',p_role:'leader'})));for(const x of replies)assert.deepEqual(x,first);const rs=await roster(e);assert.equal(rs.rows.length,1);assert.equal(rs.rows[0].name,'Original');assert.equal(rs.rows[0].role,'undecided');assert.equal(rs.rows[0].confirmed,true);assert.equal(sql(`select count(*) from public.artist_rsvp_notifications where event_id=${q(e)} and kind='main_receipt'`),'1');},
 async F6(){
  await checks.U9();const e=await create({rsvp_limit:1});for(let i=0;i<3;i++)await submit(e,`race-${i}@fixture.example`);
  let rs=await roster(e);await remove(rs.rows.find(x=>x.placement==='main_list'));
  const race=await Promise.all(rs.rows.filter(x=>x.placement==='waitlist').map(r=>rpc('artist_rsvp_update',users.owner,{p_rsvp_id:r.id,p_expected_version:r.version,p_changes:{promote:true}},true)));
  assert.equal(race.filter(x=>!x.code).length,1);assert.equal((await roster(e)).totals.main_list,1);
  for(let round=0;round<4;round++){
   const limited=await create({rsvp_limit:2});await submit(limited,`race-base-${round}@fixture.example`);const first=(await roster(limited)).rows[0];
   await Promise.all([rpc('artist_event_update',users.owner,{p_event_id:limited,p_payload:{rsvp_limit:1}},true),submit(limited,`race-new-${round}@fixture.example`),remove(first)]);
   const final=await roster(limited);assert.ok(final.totals.main_list<=final.event.rsvp_limit);assert.equal(final.rows.length,1);assert.equal(final.totals.confirmed,0);
  }
 },
 async F7(){const e=await create();await submit(e,'old@fixture.example');let r=await update((await roster(e)).rows[0],{confirmed:true});const stale={...r};r=await update(r,{email:'corrected@fixture.example'});assert.equal(r.confirmed,true);assert.equal(r.contact_version,2);await denied('artist_rsvp_update',users.owner,{p_rsvp_id:stale.id,p_expected_version:stale.version,p_changes:{confirmed:false}});r=await update(r,{name:'Correction',role:'leader',contacted:true});const pending=JSON.parse(sql(`select json_agg(n) from public.artist_rsvp_notifications n where event_id=${q(e)} and kind='acceptance'`));assert.ok(pending.some(n=>n.recipient_email==='old@fixture.example'&&n.status==='suppressed'));const current=pending.find(n=>n.recipient_email==='corrected@fixture.example');assert.equal(await rpc('artist_rsvp_notification_allowed',service,{p_id:current.id}),true);await submit(e,'conflict@fixture.example');await denied('artist_rsvp_update',users.owner,{p_rsvp_id:r.id,p_expected_version:r.version,p_changes:{email:'conflict@fixture.example'}});},
 async F8(){
  const e=await create();
  const fault=async(action)=>{
   const before=sql(`select jsonb_build_object('event',(select to_jsonb(e) from public.events e where id=${q(e)}),'rows',(select coalesce(jsonb_agg(r order by id),'[]') from public.artist_event_rsvps r where event_id=${q(e)}),'intents',(select count(*) from public.artist_rsvp_notifications where event_id=${q(e)}))`);
   sql(`create function public.fixture_fail_intent() returns trigger language plpgsql as $$ begin raise exception 'isolated intent failure'; end $$; create trigger fixture_fail_intent before insert on public.artist_rsvp_notifications for each row execute function public.fixture_fail_intent();`);
   try{await action();const after=sql(`select jsonb_build_object('event',(select to_jsonb(e) from public.events e where id=${q(e)}),'rows',(select coalesce(jsonb_agg(r order by id),'[]') from public.artist_event_rsvps r where event_id=${q(e)}),'intents',(select count(*) from public.artist_rsvp_notifications where event_id=${q(e)}))`);assert.equal(after,before);}
   finally{sql('drop trigger fixture_fail_intent on public.artist_rsvp_notifications; drop function public.fixture_fail_intent();');}
  };
  await fault(()=>denied('artist_rsvp_submit',service,{p_event_id:e,p_name:'Guest',p_email:'atomic@fixture.example',p_role:'leader',p_ip_key:hash('atomic'),p_email_key:hash('atomic-email')}));
  await submit(e,'atomic@fixture.example');let r=(await roster(e)).rows[0];
  await fault(()=>denied('artist_rsvp_update',users.owner,{p_rsvp_id:r.id,p_expected_version:r.version,p_changes:{confirmed:true}}));
  r=await update(r,{confirmed:true});
  await fault(()=>denied('artist_rsvp_update',users.owner,{p_rsvp_id:r.id,p_expected_version:r.version,p_changes:{confirmed:false}}));
  await fault(()=>denied('artist_rsvp_remove',users.owner,{p_rsvp_id:r.id,p_expected_version:r.version}));
  await fault(()=>denied('artist_event_update',users.owner,{p_event_id:e,p_payload:{event_date:'2099-12-08T19:00:00Z'}}));
  let deletionFailed=false;try{sql(`delete from public.events where id=${q(e)}`)}catch{deletionFailed=true}assert.ok(deletionFailed);
  await remove(r);const n=JSON.parse(sql(`select row_to_json(n) from public.artist_rsvp_notifications n where event_id=${q(e)} and kind='withdrawal'`));
  assert.equal(n.rsvp_id,null);assert.equal(n.recipient_email,'atomic@fixture.example');assert.equal(await rpc('artist_rsvp_notification_allowed',service,{p_id:n.id}),true);
 },
 async F10(){
  sql('truncate public.artist_rsvp_abuse_counters');const e=await create();const ip=hash('shared-ip');
  const res=await Promise.all(Array.from({length:31},(_,i)=>submit(e,`limit-${i}@fixture.example`,{p_ip_key:ip})));
  assert.equal(res.filter(x=>x.status==='received').length,30);const throttled=res.find(x=>x.status==='rate_limited');assert.ok(throttled.retry_after>0&&throttled.retry_after<=600);
  sql('truncate public.artist_rsvp_abuse_counters');const email=await create();
  const duplicates=await Promise.all(Array.from({length:5},()=>submit(email,'same-limit@fixture.example')));assert.equal(duplicates.filter(x=>x.status==='received').length,3);assert.equal((await roster(email)).rows.length,1);
  assert.equal(sql(`select count(*) from public.artist_rsvp_notifications where event_id=${q(email)} and kind='main_receipt'`),'1');
  for(const [scope,ceiling] of [['event',200],['site',1000]]){
   sql('truncate public.artist_rsvp_abuse_counters');const target=await create();const key=scope==='event'?target:'site';
   sql(`insert into public.artist_rsvp_abuse_counters(scope,key,window_start,attempts,expires_at) values(${q(scope)},${q(key)},to_timestamp(floor(extract(epoch from now())/600)*600),${ceiling-2},now()+interval '24 hours')`);
   const race=await Promise.all(Array.from({length:5},(_,i)=>submit(target,`${scope}-${i}@fixture.example`)));assert.equal(race.filter(x=>x.status==='received').length,2);assert.equal((await roster(target)).rows.length,2);
  }
  sql('truncate public.artist_rsvp_abuse_counters');const w=await create();
  sql(`insert into public.artist_rsvp_abuse_counters(scope,key,window_start,attempts,expires_at) values('site','site',to_timestamp(floor(extract(epoch from now())/600)*600)-interval '10 minutes',1001,now()+interval '1 hour'),('ip',${q(hash('expired'))},now()-interval '25 hours',31,now()-interval '1 hour')`);
  assert.equal((await submit(w,'new-window@fixture.example')).status,'received');assert.equal(sql(`select count(*) from public.artist_rsvp_abuse_counters where expires_at<=now()`),'0');
  assert.equal(sql(`select count(*) from public.artist_rsvp_abuse_counters where key like '%@%' or key='192.0.2.1'`),'0');
  const due=await rpc('artist_rsvp_notifications_due',service,{p_limit:999});assert.ok(due.length<=20);const n=due[0];
  const claim=await rpc('artist_rsvp_notification_claim',service,{p_id:n});assert.equal(await rpc('artist_rsvp_notification_claim',service,{p_id:n}),null);
  sql(`update public.artist_rsvp_notifications set lease_expires_at=now()-interval '1 second' where id=${q(n)}`);
  const again=await rpc('artist_rsvp_notification_claim',service,{p_id:n});assert.equal(again.idempotency_key,claim.idempotency_key);assert.deepEqual(again.facts,claim.facts);assert.notEqual(again.token,claim.token);
  assert.equal(await rpc('artist_rsvp_notification_finish',service,{p_id:n,p_token:claim.token,p_status:'sent',p_provider_id:'old',p_failure:null}),false);
  assert.equal(await rpc('artist_rsvp_notification_finish',service,{p_id:n,p_token:again.token,p_status:'failed',p_provider_id:null,p_failure:'ambiguous'}),true);assert.equal(sql(`select status from public.artist_rsvp_notifications where id=${q(n)}`),'pending');
  assert.equal(sql(`select next_attempt_at>now()+interval '14 minutes' and next_attempt_at<=now()+interval '15 minutes' from public.artist_rsvp_notifications where id=${q(n)}`),'t');
  sql(`update public.artist_rsvp_notifications set attempts=5,next_attempt_at=now()-interval '1 second' where id=${q(n)}`);await rpc('artist_rsvp_notifications_due',service,{p_limit:20});assert.equal(sql(`select status||':'||failure from public.artist_rsvp_notifications where id=${q(n)}`),'failed:exhausted');
  const expired=due[1];sql(`update public.artist_rsvp_notifications set first_attempt_at=now()-interval '23 hours',attempts=1 where id=${q(expired)}`);assert.equal(await rpc('artist_rsvp_notification_claim',service,{p_id:expired}),null);
  await rpc('artist_rsvp_notifications_due',service,{p_limit:20});assert.equal(sql(`select status from public.artist_rsvp_notifications where id=${q(expired)}`),'failed');
 },
 async R6(){const e=await rpc('organizer_create_event',users.organizer,{p_organizer_id:organizer,p_payload:{title:'Organizer draft',event_type:'social',city:'boston',event_date:base.event_date},p_publish:false});await denied('organizer_publish_event',users.organizer,{p_event_id:e,p_ack:{}});await rpc('organizer_publish_event',users.organizer,{p_event_id:e,p_ack:ack});assert.equal(sql(`select publication_ack_by from public.events where id=${q(e)}`),users.organizer.id);assert.equal((await http('events',jwt(users.organizer),{title:'Forged',event_type:'social',city:'boston',event_date:base.event_date,status:'pending',source_type:'artist',submitter_id:users.organizer.id})).ok,false);}
};
async function browserStack(){
 const paid=await create();for(let i=0;i<28;i++)await submit(paid,`browser-${i}@fixture.example`);
 const free=await create({title:'Free rhythm workshop',price_type:'free',rsvp_link:null});
 const closed=await create({title:'Closed workshop'});await rpc('artist_event_update',users.owner,{p_event_id:closed,p_payload:{rsvp_closed:true}});
 const waiting=await create({title:'Waiting room workshop',rsvp_limit:1});await submit(waiting,'main@fixture.example');await submit(waiting,'waiting@fixture.example');await update((await roster(waiting)).rows.find(r=>r.placement==='main_list'),{confirmed:true});
 sql(`update public.artist_rsvp_notifications set status='failed',failure='ambiguous' where event_id=${q(waiting)} and kind='acceptance';`);
 const orgDraft=await rpc('organizer_create_event',users.organizer,{p_organizer_id:organizer,p_payload:{title:'Organizer draft for checklist',event_type:'social',city:'boston',event_date:base.event_date},p_publish:false});
 const session=u=>({access_token:jwt(u),refresh_token:`local-fixture-${u.id}`,expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:u.id,email:u.email,aud:'authenticated',role:'authenticated',app_metadata:{role:u.platform,provider:'email',providers:['email']},user_metadata:{display_name:'Fixture User'},created_at:'2026-11-15T00:00:00Z',email_confirmed_at:'2026-11-15T00:00:00Z'}});
 const sessions=Object.fromEntries(Object.entries(users).map(([key,u])=>[key,session(u)]));
 const fixture={artist,organizer,events:{paid,free,closed,waiting,orgDraft},sessions};
 const guestPort=await port();
 gateway=createHttpServer(async(request,response)=>{
  const origin=request.headers.origin;
  if(origin&&['http://localhost:5199','http://127.0.0.1:5199'].includes(origin))response.setHeader('Access-Control-Allow-Origin',origin);
  response.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,range,accept-profile,content-profile');
  response.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');
  response.setHeader('Access-Control-Expose-Headers','Content-Range,Retry-After');
  const json=(status,value)=>{response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(value));};
  if(request.method==='OPTIONS'){response.writeHead(204);response.end();return;}
  const url=new URL(request.url,'http://localhost:54321');
  if(url.pathname==='/__fixtures'){json(200,fixture);return;}
  if(url.pathname==='/auth/v1/user'){
   const token=request.headers.authorization?.replace(/^Bearer /i,'');const current=Object.values(sessions).find(s=>s.access_token===token);
   json(current?200:401,current?current.user:{error:'Local fixture session required'});return;
  }
  if(url.pathname==='/auth/v1/logout'){json(200,{});return;}
  if(url.pathname.startsWith('/auth/v1/')){json(400,{error:'Use the owned local fixture session; this gateway does not implement GoTrue.'});return;}
  if(['/batch/','/batch','/flags/','/flags','/decide/'].includes(url.pathname)){json(200,{featureFlags:{},errorsWhileComputingFlags:false});return;}
  let target;
  if(url.pathname.startsWith('/rest/v1/'))target=`http://127.0.0.1:${apiPort}/${url.pathname.slice(9)}${url.search}`;
  else if(url.pathname==='/functions/v1/artist-rsvp-submit')target=`http://127.0.0.1:${guestPort}/`;
  else {json(404,{error:'Not supported by isolated local harness'});return;}
  try{
   const headers=new Headers(Object.entries(request.headers).flatMap(([key,value])=>value===undefined?[]:[[key,Array.isArray(value)?value.join(','):value]]));headers.delete('host');headers.delete('connection');
   if(headers.get('authorization')==='Bearer local-anon-key')headers.set('authorization',`Bearer ${jwt(null,'anon')}`);
   if(target.includes(`:${guestPort}/`))headers.set('x-forwarded-for',request.socket.remoteAddress??'unknown');
   const remote=await fetch(target,{method:request.method,headers,...(!['GET','HEAD'].includes(request.method)?{body:request,duplex:'half'}:{})});
   response.statusCode=remote.status;for(const [key,value] of remote.headers)if(!['transfer-encoding','connection','content-encoding','content-length'].includes(key))response.setHeader(key,value);
   response.end(Buffer.from(await remote.arrayBuffer()));
  }catch{json(503,{error:'Isolated local service unavailable'});}
 });
 const listening=Promise.withResolvers();gateway.once('error',listening.reject);gateway.listen(54321,'127.0.0.1',listening.resolve);await listening.promise;
 const adapter=join(temp,'guest.ts');
 await writeFile(adapter,`import { runtimeDependencies } from ${JSON.stringify(pathToFileURL(join(root,'supabase/functions/artist-rsvp-submit/index.ts')).href)};\nimport { createArtistRsvpSubmit } from ${JSON.stringify(pathToFileURL(join(root,'supabase/functions/_shared/artistRsvpSubmit.ts')).href)};\nconst handler=createArtistRsvpSubmit(runtimeDependencies());Deno.serve({hostname:"127.0.0.1",port:${guestPort}},handler);\n`);
 const guest=spawn('deno',['run',`--allow-net=127.0.0.1:${guestPort},127.0.0.1:54321`,`--allow-env=SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,RSVP_RATE_LIMIT_SECRET,RSVP_ALLOWED_ORIGINS`,adapter],{env:{...process.env,SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_SERVICE_ROLE_KEY:service,RSVP_RATE_LIMIT_SECRET:randomUUID()+randomUUID(),RSVP_ALLOWED_ORIGINS:'http://localhost:5199,http://127.0.0.1:5199'},stdio:['ignore','ignore','pipe']});children.push(guest);
 let guestLog='';guest.stderr.on('data',chunk=>guestLog+=chunk);let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${guestPort}/`,{method:'OPTIONS'})).status===204){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,guestLog);
 console.log('LOCAL_RSVP_READY '+JSON.stringify({gateway:'http://localhost:54321',fixtures:'http://localhost:54321/__fixtures',artist,events:fixture.events}));
 console.log('VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=local-anon-key VITE_POSTHOG_KEY=phc_local VITE_POSTHOG_HOST=http://localhost:54321 VITE_GOOGLE_CLIENT_ID= npx vite --port 5199 --strictPort');
 await Promise.withResolvers().promise;
}
async function cleanup(){
 if(gateway){gateway.closeAllConnections();const closed=Promise.withResolvers();gateway.close(closed.resolve);await closed.promise;gateway=null;}
 for(const child of children)if(child.exitCode===null){const exited=Promise.withResolvers();child.once('exit',exited.resolve);child.kill('SIGTERM');await exited.promise;}
 if(started){run('pg_ctl',['-D',join(temp,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});started=false;}await rm(temp,{recursive:true,force:true});
}
let cleaning=false;for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{if(cleaning)return;cleaning=true;cleanup().then(()=>process.exit(0));});
try{
 run('initdb',['-D',join(temp,'data'),'-U','postgres','-A','trust','--no-locale'],{stdio:'ignore'});
 run('pg_ctl',['-D',join(temp,'data'),'-l',join(temp,'postgres.log'),'-o',`-p ${pgPort} -h 127.0.0.1 -k ${temp}`,'-w','start'],{stdio:'ignore'});started=true;
 sql(bootstrap);
 for(const name of (await readdir(join(root,'supabase/migrations'))).filter(x=>x.endsWith('.sql')).sort()){
  try{sql(await readFile(join(root,'supabase/migrations',name),'utf8'));}catch(e){throw Error(`Migration failed: ${name}`,{cause:e});}
 }
 sql(await readFile(join(root,'scripts/artist-rsvp-acceptance/verify.sql'),'utf8'));
 const config=join(temp,'postgrest.conf');await writeFile(config,`db-uri = "postgresql://authenticator@127.0.0.1:${pgPort}/postgres"\ndb-schemas = "public"\ndb-anon-role = "anon"\ndb-extra-search-path = "public,extensions"\njwt-secret = "${secret}"\nserver-host = "127.0.0.1"\nserver-port = ${apiPort}\n`);
 const api=spawn('postgrest',[config],{stdio:['ignore','ignore','pipe']});children.push(api);let apiLog='';api.stderr.on('data',x=>apiLog+=x);let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${apiPort}/`);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,apiLog);
 await fixtures();
 if(serve)await browserStack();
 for(const id of caseId==='all'?cases:[caseId]){await checks[id]();console.log(`${id} PASS`);}
}catch(error){console.error(error);process.exitCode=1;}finally{await cleanup();}
