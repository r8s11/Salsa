import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
const database=process.argv[2]??'salsa_analytics_p6';
if(!/^salsa_analytics_p6(?:_[a-z0-9]+)?$/.test(database))throw Error('Disposable Phase6 local clone required');
const args=['exec','-i','supabase_db_Salsa','psql','-U','postgres','-d',database,'-qAt','-v','ON_ERROR_STOP=1'];
function sql(text){const r=spawnSync('docker',args,{input:text,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();}
function asyncSql(text){const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let output='',error='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>error+=chunk);child.stdin.end(text);return once(child,'exit').then(([code])=>{if(code!==0)throw Error(error);return output.trim();});}
const id='00000000-0000-4000-8000-000000006900';
const worker="select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false);";
const evaluation=worker+"select public.admin_analytics_evaluate('2026-03-09 13:00+00')->>'status';";
try {
 sql(readFileSync('sql/final-verification/admin-analytics-phase6-regression.sql','utf8'));
 sql(`set session_replication_role=replica;insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('${id}','phase6-concurrency@example.com','{"role":"admin"}','{}');set session_replication_role=origin;insert into public.admin_analytics_preferences(admin_id,frequency,email_enabled,enabled_at) values('${id}','daily',true,'2026-03-01');`);
 // Hold the exact worker lock until both overlapping evaluations report busy.
 const lock=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let locked='';
 const ready=new Promise((resolve,reject)=>{lock.stdout.on('data',chunk=>{locked+=chunk;if(locked.includes('locked'))resolve();});lock.on('error',reject);lock.on('exit',code=>{if(code!==0)reject(Error('lock session failed'));});});
 lock.stdin.write("begin;select pg_advisory_xact_lock(681606);select 'locked';\n");
 await ready;
 try {const busy=await Promise.all([asyncSql(evaluation),asyncSql(evaluation)]);assert(busy.every(value=>value.endsWith('busy')),'overlapping evaluators must skip');}
 finally {lock.stdin.end('rollback;\n');await once(lock,'exit');}
 await Promise.all([asyncSql(evaluation),asyncSql(evaluation)]);
 assert.equal(sql("select count(*) from public.admin_analytics_report_runs where frequency='daily';"),'1','one report across concurrent runs');
 assert.equal(sql("select count(*) from public.admin_analytics_notification_deliveries where kind='report';"),'1','one recipient notification across concurrent runs');
 const delivery=sql("select id from public.admin_analytics_notification_deliveries where kind='report';");
 const claims=await Promise.all([asyncSql(worker+`select coalesce(public.admin_analytics_claim_delivery('${delivery}')->>'token','no_claim');`),asyncSql(worker+`select coalesce(public.admin_analytics_claim_delivery('${delivery}')->>'token','no_claim');`)]);
 assert.equal(claims.filter(value=>!value.endsWith('no_claim')).length,1,'one exclusive email claimant');
 // Real SQL role checks: raw data is denied, self-service RPC remains administrator-only.
 assert.equal(sql(`begin;set local role authenticated;select set_config('request.jwt.claims','{"sub":"${id}","app_metadata":{"role":"admin"}}',true);select public.admin_analytics_monitoring()#>>'{preferences,frequency}';rollback;`).split('\n').at(-1),'daily');
 console.log('PASS: Phase6 SQL fixtures, concurrent evaluation lock, report/outbox deduplication, exclusive delivery claim, authenticated administrator RPC.');
} finally {
 sql(`delete from auth.users where id='${id}';delete from public.admin_analytics_report_runs;delete from public.admin_analytics_alerts;update public.admin_analytics_monitor_state set evaluated_at=null,sources='{}';`);
}
