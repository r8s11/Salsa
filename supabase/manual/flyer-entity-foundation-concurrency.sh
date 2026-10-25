#!/usr/bin/env bash
# Flyer -> entity foundation: concurrency smoke against a REAL Postgres.
#
#   CONTAINER=supabase_db_Salsa DB=postgres \
#     bash supabase/manual/flyer-entity-foundation-concurrency.sh
#
# Requires migration 20260929000000_flyer_entity_foundation.sql. Unlike the
# single-session smoke (flyer-entity-foundation-smoke.sql) this COMMITS, because
# two real sessions must race. Every row it creates is tagged and deleted by the
# EXIT trap (events, entities, submissions, fixture auth user/profile).
#
# Proves, with one session deliberately holding its transaction open (pg_sleep)
# so the second session genuinely contends:
#   1. two different events saving the same NEW venue/instructor concurrently
#      produce exactly one venue and one instructor (second session blocks on
#      the advisory lock, re-queries, reuses);
#   2. two concurrent approvals of one submission produce exactly one event and
#      one venue, and return the same event id;
#   3. opposite-order instructor lists do not deadlock and create each person
#      exactly once.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_Salsa}"
DB="${DB:-postgres}"
TAG="smokeconc$$"
MOD='00000000-0000-4000-8000-0000000000c2'
CLAIMS="{\"sub\":\"$MOD\",\"role\":\"authenticated\",\"email\":\"$TAG@example.test\",\"app_metadata\":{\"role\":\"moderator\"}}"

psql_() { docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -At -q "$@"; }
fail() { echo "FAIL: $*" >&2; exit 1; }
now_ms() { date +%s%3N; }

cleanup() {
  psql_ <<SQL >/dev/null 2>&1 || true
delete from public.audit_logs where actor_id = '$MOD' or metadata::text like '%$TAG%';
delete from public.events where title like '$TAG%';
delete from public.event_submissions where submitted_data ->> 'title' like '$TAG%';
delete from public.venues where name like '$TAG%';
delete from public.organizers where name like '$TAG%';
delete from public.instructors where name like '$TAG%';
delete from public.schools where name like '$TAG%';
delete from public.profiles where id = '$MOD';
delete from auth.users where id = '$MOD';
SQL
}
trap cleanup EXIT

psql_ <<SQL >/dev/null
insert into auth.users (id, email, aud, role, raw_app_meta_data)
values ('$MOD', '$TAG@example.test', 'authenticated', 'authenticated', '{"role":"moderator"}');
insert into public.profiles (id) values ('$MOD') on conflict (id) do nothing;
SQL

review() { # $1 venue name, $2.. instructor names
  local venue="$1"; shift
  local instr=""
  for n in "$@"; do
    instr="$instr{\"candidate\":{\"name\":\"$n\",\"instagram\":\"${n// /}ig\"},\"state\":\"NEW\",\"matches\":[],\"decision\":\"new\",\"selected_id\":null},"
  done
  instr="[${instr%,}]"
  echo "{\"venue\":{\"candidate\":{\"name\":\"$venue\",\"address\":\"1 Race Street\",\"city\":\"Boston\"},\"state\":\"NEW\",\"matches\":[],\"decision\":\"new\",\"selected_id\":null},\"instructors\":$instr}"
}

save_sql() { # $1 title, $2 review json, $3 hold seconds
  cat <<SQL
select set_config('request.jwt.claims', '$CLAIMS', false);
set role authenticated;
begin;
select public.save_event_with_entities(null,
  '{"title":"$1","event_type":"social","city":"boston","event_date":"2031-01-01T20:00:00Z","entity_review":$2}', false);
select pg_sleep($3);
commit;
SQL
}

count() { psql_ -c "$1"; }

# ---------------------------------------------------------------- 1
R1="$(review "$TAG Venue One" "$TAG Teacher One")"
save_sql "$TAG A1" "$R1" 2 | psql_ >/dev/null &
PID_A=$!
sleep 0.7
T0=$(now_ms)
save_sql "$TAG B1" "$R1" 0 | psql_ >/dev/null
ELAPSED=$(( $(now_ms) - T0 ))
wait "$PID_A"
[ "$ELAPSED" -ge 800 ] || fail "1: second session did not block on the first (took ${ELAPSED}ms)"
[ "$(count "select count(*) from public.venues where name = '$TAG Venue One'")" = 1 ] || fail "1: duplicate venue"
[ "$(count "select count(*) from public.instructors where name = '$TAG Teacher One'")" = 1 ] || fail "1: duplicate instructor"
[ "$(count "select count(distinct venue_id) from public.events where title in ('$TAG A1','$TAG B1')")" = 1 ] || fail "1: events not linked to the same venue"
echo "ok 1: concurrent identical saves -> one venue, one instructor (second blocked ${ELAPSED}ms)"

# ---------------------------------------------------------------- 2
SUB="$(psql_ -c "select gen_random_uuid()")"
psql_ <<SQL >/dev/null
insert into public.event_submissions (id, status, submitter_email, submitted_data)
values ('$SUB', 'pending', '$TAG@example.test',
  '{"title":"$TAG Sub","event_type":"social","city":"boston","event_date":"2031-02-01T20:00:00Z"}');
select set_config('request.jwt.claims', '$CLAIMS', false);
set role authenticated;
update public.event_submissions set edited_data = '{"entity_review":{"venue":{"candidate":{"name":"$TAG Venue Two","address":"2 Race Street","city":"Boston"},"state":"NEW","matches":[],"decision":"new","selected_id":null}}}'
 where id = '$SUB';
SQL
approve_sql() {
  cat <<SQL
select set_config('request.jwt.claims', '$CLAIMS', false);
set role authenticated;
begin;
select public.approve_event_submission('$SUB', '{}');
select pg_sleep($1);
commit;
SQL
}
approve_sql 2 | psql_ > /tmp/$TAG.a.out &
PID_A=$!
sleep 0.7
T0=$(now_ms)
approve_sql 0 | psql_ > /tmp/$TAG.b.out
ELAPSED=$(( $(now_ms) - T0 ))
wait "$PID_A"
EA="$(grep -E '^[0-9a-f-]{36}$' /tmp/$TAG.a.out)"; EB="$(grep -E '^[0-9a-f-]{36}$' /tmp/$TAG.b.out)"
rm -f /tmp/$TAG.a.out /tmp/$TAG.b.out
[ -n "$EA" ] && [ "$EA" = "$EB" ] || fail "2: approvals returned different events ($EA vs $EB)"
[ "$ELAPSED" -ge 800 ] || fail "2: second approval did not block on the submission row (${ELAPSED}ms)"
[ "$(count "select count(*) from public.events where title = '$TAG Sub'")" = 1 ] || fail "2: duplicate events"
[ "$(count "select count(*) from public.venues where name = '$TAG Venue Two'")" = 1 ] || fail "2: duplicate venue"
echo "ok 2: concurrent approvals -> one event ($EA), one venue"

# ---------------------------------------------------------------- 3
RX="$(review "$TAG Venue Three" "$TAG Teacher X" "$TAG Teacher Y")"
RY="$(review "$TAG Venue Three" "$TAG Teacher Y" "$TAG Teacher X")"
save_sql "$TAG A3" "$RX" 1 | psql_ >/dev/null &
PID_A=$!
sleep 0.3
save_sql "$TAG B3" "$RY" 0 | psql_ >/dev/null || fail "3: opposite-order save failed (deadlock?)"
wait "$PID_A" || fail "3: first session failed (deadlock?)"
[ "$(count "select count(*) from public.instructors where name in ('$TAG Teacher X','$TAG Teacher Y')")" = 2 ] || fail "3: instructors not created exactly once"
[ "$(count "select count(*) from public.venues where name = '$TAG Venue Three'")" = 1 ] || fail "3: duplicate venue"
echo "ok 3: opposite-order instructor lists -> no deadlock, each created once"

echo "FLYER ENTITY CONCURRENCY OK"
