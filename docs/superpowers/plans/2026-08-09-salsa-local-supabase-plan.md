# Salsa — local Supabase development stack

## Context

`/home/r8s/code/Salsa` (salsasegura.com) is a React+Vite SPA that talks directly to a hosted Supabase project from the browser — there is no backend server. It currently has **no local development setup at all**: no `.env` files exist on disk, and `src/lib/supabase.ts` throws at module load when `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` is missing, so `npm run dev` cannot start. The only way to run it today is against the live production project.

Stand up a local Supabase stack via the Supabase CLI so Salsa runs entirely on this machine during development, with production continuing to live on the hosted Supabase project (`https://tlajzziavbnfomhfwofw.supabase.co`).

**Salsa deliberately does not join the shared `devdb` Postgres.** It is a Supabase-native app whose two next roadmap items (`Docs/ROADMAP.md` "Next Up": Authentication Week 5, Moderation dashboard Week 6) both require Supabase Auth/GoTrue. Reproducing PostgREST + GoTrue + URL routing by hand on top of devdb would be bespoke config with real drift risk against the hosted project. Salsa gets the CLI's own Postgres 17 on port 54322; `devdb` (port 5432) remains the dev database for the plain-Postgres projects (piggy, salsatd, and WODCard when it lands).

## Approach

Steps are ordered; each leaves the tree in a working state. Steps 3–5 are independent of each other but all must land before Step 7 can verify.

### Step 1 — Install the Supabase CLI as a devDependency

The CLI is **not** installed on this machine (`which supabase` → not found; not in `node_modules/.bin`; not global). Note that `npx --no supabase --version` misleadingly prints `10.9.8` — that is npx answering for *itself*, not the Supabase CLI, whose current version is `2.113.0`.

```bash
cd /home/r8s/code/Salsa
npm install -D supabase@2.113.0
npx supabase --version    # must print 2.113.0
```

Both download paths were confirmed reachable this session (GitHub release asset `https://github.com/supabase/cli/releases/download/v2.113.0/supabase_linux_amd64.tar.gz` → HTTP 200; npm tarball → HTTP 200), and the Docker registry is reachable for the image pulls in Step 7.

**Contingency — if the postinstall binary download fails** (this box hit exactly that failure mode recently with a different package whose CDN 404'd): download the release tarball directly and place the binary on PATH for the project:

```bash
cd /home/r8s/code/Salsa
curl -fL -o /tmp/supabase.tar.gz \
  https://github.com/supabase/cli/releases/download/v2.113.0/supabase_linux_amd64.tar.gz
mkdir -p node_modules/.bin && tar -xzf /tmp/supabase.tar.gz -C node_modules/.bin supabase
node_modules/.bin/supabase --version
```
If that is used, every later `npx supabase …` in this plan becomes `node_modules/.bin/supabase …`.

Then add three scripts to `package.json`'s `"scripts"` block, after the existing `"import-events"` entry:

```json
"db:start": "supabase start",
"db:stop": "supabase stop",
"db:reset": "supabase db reset"
```

### Step 2 — Trim `supabase/config.toml` to the services Salsa actually needs

`supabase/config.toml` already exists and is fully initialized (`project_id = "Salsa"`, `major_version = 17`). Its defaults enable every service, which would start ~10 containers. This host currently runs 10 containers with ~4.5 GiB RAM available and 2.6 GiB already swapped, so trim to what is needed.

Salsa's entire runtime Supabase footprint today is PostgREST — the only two client call sites in the app are `supabase.from("events").select(...)` and `.insert(...)` in `src/features/events/api/eventsRepo.ts`. Keep `[auth]` enabled anyway because Authentication and the Moderation dashboard are the next two roadmap items; disable the rest.

Set `enabled = false` at these exact lines in `supabase/config.toml` (each is the `enabled` line immediately under its section header):

| Line | Section | Change |
|---|---|---|
| 78 | `[realtime]` | `enabled = true` → `enabled = false` |
| 96 | `[inbucket]` | `enabled = true` → `enabled = false` |
| 106 | `[storage]` | `enabled = true` → `enabled = false` |
| 354 | `[edge_runtime]` | `enabled = true` → `enabled = false` |
| 368 | `[analytics]` | `enabled = true` → `enabled = false` |

Leave `[api]`, `[db]`, `[studio]`, and `[auth]` enabled and otherwise untouched. Re-read the file before editing — line numbers are hints, match on the section header above each `enabled` line.

Inbucket is safe to disable because `[auth.email] enable_confirmations = false` (line 205) already means no confirmation emails are sent locally.

### Step 3 — Add a baseline schema migration

`supabase/migrations/` contains exactly one file, `20260714T000000_add_event_module_fields.sql`, and it is an **incremental** `alter table events add column …` with no `CREATE TABLE` anywhere. The real schema history was applied by hand against hosted Supabase through the SQL editor and lives in `Docs/sql queries/*.sql`. Consequently `supabase db reset` fails today — the ALTER runs against a table that does not exist.

Create `supabase/migrations/20260101T000000_baseline_events_schema.sql` with exactly this content. The timestamp is deliberately back-dated so it sorts before the existing migration; it reconstructs the table's pre-`20260714` state so the existing migration still applies meaningfully on top.

```sql
-- Baseline schema for public.events, reconstructed from the hand-applied
-- history in Docs/sql queries/ (events.sql + add_submitter_columns.sql +
-- fix_price_amount_typo.sql + add_city_column.sql).
--
-- Back-dated so it sorts before 20260714T000000_add_event_module_fields.sql,
-- which adds host/recurrence/gallery on top of this.
--
-- Not yet reconciled against the hosted production project — see the
-- reconciliation note in this migration's plan before running `db push`.

create table public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  event_type      text check (event_type in ('social', 'workshop', 'class')),
  event_date      timestamp with time zone not null,
  event_time      text,
  location        text,
  address         text,
  price_type      text check (price_type in ('free', 'paid')),
  price_amount    numeric(10, 2),
  rsvp_link       text,
  image_url       text,
  status          text default 'approved',
  submitter_name  text,
  submitter_email text,
  created_at      timestamp with time zone default now(),
  city            text check (city in ('boston', 'new-york-city')) default 'boston'
);

create index events_event_date_idx on public.events (event_date);
create index events_city_idx on public.events (city);

alter table public.events enable row level security;

-- Public read access, approved events only.
create policy "Public events are viewable by everyone"
  on public.events
  for select
  using (status = 'approved');
```

Notes that prevent wrong guesses while writing this:
- `gen_random_uuid()` is native from Postgres 13 on; `major_version = 17`, so **no `pgcrypto` extension is needed**.
- `status` intentionally has **no CHECK constraint** — that matches production, even though `src/features/events/model/types.ts` types it as the union `"approved" | "pending" | "rejected"`.
- Do **not** copy `Docs/sql queries/events.sql` verbatim. It is stale and broken: line 25 reads `after table` instead of `alter table` (a literal syntax error that could never have run), and it is missing 4 of the table's real columns (`city`, `host`, `recurrence`, `gallery`).
- Leave `supabase/migrations/20260714T000000_add_event_module_fields.sql` **unchanged**.

### Step 4 — Add the current INSERT policy as a migration

`Docs/sql queries/fix_insert_rls.sql` holds the currently-active insert policy, which supersedes the permissive `with check (true)` policy from `events.sql`. Because the baseline in Step 3 never creates that superseded policy, this migration only needs to create the live one.

Create `supabase/migrations/20260809T000000_events_insert_policy.sql`:

```sql
-- Anon insert capped to status='pending' so anonymous writes can never bypass
-- moderation. Mirrors Docs/sql queries/fix_insert_rls.sql as applied to
-- production. Both SubmitEventPage and scripts/import-ics.mjs insert with
-- status='pending'.

-- Policies sit on top of grants — without the grant, the policy never runs.
grant insert on public.events to anon, authenticated;

create policy "Anon can submit pending events"
  on public.events
  for insert
  to anon, authenticated
  with check (status = 'pending');
```

The `anon` and `authenticated` roles are pre-created by the Supabase CLI's Postgres image, so no `create role` is needed. Omit the `notify pgrst, 'reload schema'` line from the source file — it exists to bust a live PostgREST cache after a manual SQL-editor change and is meaningless inside a migration that runs before PostgREST starts.

There is deliberately **no UPDATE or DELETE policy**: with RLS on and no policy for an operation, Postgres denies it to non-owner roles. That matches production, where approving an event is a manual privileged action.

### Step 5 — Create the seed file

`supabase/config.toml` line 65 declares `sql_paths = ["./seed.sql"]`, but **`supabase/seed.sql` does not exist** — `supabase db reset` currently has nothing to seed with, which would leave the calendar empty and make verification impossible.

Create `supabase/seed.sql`:

```sql
-- Local development seed. Dates are relative to now() so seeded events never
-- age out of the calendar's forward-looking query
-- (fetchApprovedEvents filters event_date >= yesterday).

insert into public.events
  (title, description, event_type, city, event_date, event_time, location, address,
   price_type, price_amount, rsvp_link, status, submitter_name, submitter_email)
values
  ('Bachata Sensual Social', 'Weekly social with a beginner lesson at 8pm.',
   'social', 'boston', now() + interval '2 days', '8:00 PM',
   'Dance Union', '16 Bow St, Somerville, MA',
   'paid', 15.00, 'https://example.com/rsvp/1', 'approved',
   'Seed Data', 'seed@local.dev'),

  ('Salsa On2 Workshop', 'Intermediate shines and partnerwork.',
   'workshop', 'boston', now() + interval '5 days', '2:00 PM',
   'Metromovers', '373 Somerville Ave, Somerville, MA',
   'paid', 35.00, 'https://example.com/rsvp/2', 'approved',
   'Seed Data', 'seed@local.dev'),

  ('Beginner Salsa Class', 'Six-week series, drop-ins welcome.',
   'class', 'boston', now() + interval '8 days', '7:00 PM',
   'Salsa y Control', '1 Westinghouse Plaza, Boston, MA',
   'free', null, null, 'approved',
   'Seed Data', 'seed@local.dev'),

  ('Mambo City Friday', 'NYC on2 social, live percussion.',
   'social', 'new-york-city', now() + interval '3 days', '9:00 PM',
   'You Should Be Dancing', '412 8th Ave, New York, NY',
   'paid', 20.00, 'https://example.com/rsvp/4', 'approved',
   'Seed Data', 'seed@local.dev'),

  ('Rumba y Timbal Workshop', 'Afro-Cuban body movement.',
   'workshop', 'new-york-city', now() + interval '11 days', '1:00 PM',
   'Ailey Extension', '405 W 55th St, New York, NY',
   'paid', 40.00, 'https://example.com/rsvp/5', 'approved',
   'Seed Data', 'seed@local.dev'),

  -- One pending row so the moderation path is exercisable locally.
  ('Unapproved Test Social', 'Should NOT appear on the public calendar.',
   'social', 'boston', now() + interval '4 days', '10:00 PM',
   'Pending Venue', '1 Test St, Boston, MA',
   'free', null, null, 'pending',
   'Seed Data', 'seed@local.dev');
```

The pending row is load-bearing for verification: it proves the SELECT policy filters correctly rather than the calendar merely showing everything.

### Step 6 — Create `.env.local`

`.env.local` is gitignored (`.gitignore:75`), so it stays local. The exact three variables the app reads are declared in `src/vite-env.d.ts:4-6`.

The API URL is fixed by `config.toml` (`[api] port = 54321`). The key is **generated by the CLI at first start** — do not invent one. After Step 7's `supabase start`, run `npx supabase status` and copy the key it labels for anonymous/publishable client use.

Create `/home/r8s/code/Salsa/.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<paste from `npx supabase status`>
VITE_WEB3FORMS_ACCESS_KEY=local-dev-unset
```

`VITE_WEB3FORMS_ACCESS_KEY` is read only inside the submit handler at `src/components/Contact/Contact.tsx:26`, never at import time, so the placeholder does not break startup — only the contact form's submit will fail locally, which is intentional (the real key in `azure-env-setup.sh` posts to the live Web3Forms endpoint and would send real email from a dev box). To exercise the contact form for real, temporarily paste the value from `azure-env-setup.sh:16`.

Because `.env.local` must exist before the app can import `src/lib/supabase.ts`, create it with a placeholder key first and fill in the real key after `supabase start` prints it.

Do **not** point local development at the production URL/key in `azure-env-setup.sh:14-15` — that is the live project serving salsasegura.com. (Separately: that file commits the production publishable and Web3Forms keys in plaintext and targets `az webapp` App Service settings that the real Azure Static Web Apps pipeline in `.github/workflows/azure-static-web-apps-lemon-stone-01afe980f.yml` does not use. Cleaning that up is not part of this work.)

### Step 7 — Start the stack and load the schema

```bash
cd /home/r8s/code/Salsa
npx supabase start          # first run pulls ~5 images; slow, expect several minutes
npx supabase status         # copy the anon/publishable key into .env.local now
npx supabase db reset       # applies the 3 migrations in order, then seed.sql
```

`db reset` must report applying all three migrations in this order — `20260101T000000_baseline_events_schema`, `20260714T000000_add_event_module_fields`, `20260809T000000_events_insert_policy` — then seeding. If it errors on the ALTER in the middle migration, the baseline from Step 3 did not land first; check the filename sorts lexicographically before it.

## Critical files & anchors

- `Salsa/src/lib/supabase.ts:8-10` — throws at import when either env var is absent. This is why `.env.local` must exist before anything runs, and why a placeholder key is needed before `supabase start` can print the real one.
- `Salsa/src/features/events/api/eventsRepo.ts:25-31,41-44` — the app's only two database call sites. `fetchApprovedEvents` filters `status='approved'` + `city` + `event_date >= yesterday`; `submitEvent` inserts with `status:'pending'`. These define exactly what the seed and RLS policies must satisfy.
- `Salsa/supabase/config.toml` — already initialized; only the five `enabled` flags in Step 2 change. `[api] port = 54321` and `[db] port = 54322` are what `.env.local` and any psql command must match.
- `Salsa/Docs/sql queries/` — the real (hand-applied) schema history that Step 3 reconstructs from. `events.sql` is stale and contains a syntax error; prefer the reconstruction in Step 3 over re-reading it.
- `Salsa/src/features/events/model/types.ts` — `DatabaseEvent`, the TypeScript shape the schema must satisfy. Note `city` is typed non-nullable there while the column is nullable in SQL.

## Verification

Run from `/home/r8s/code/Salsa` with the stack up.

**1. Stack is running and trimmed.** Confirms Step 2 actually reduced the footprint:
```bash
npx supabase status
docker ps --format '{{.Names}}' | grep supabase | wc -l
```
Expect `API URL: http://127.0.0.1:54321`, `DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres`, `Studio URL: http://127.0.0.1:54323`. Container count should be roughly 5 and must **not** include storage, realtime, edge-runtime, analytics, or inbucket containers.

**2. Schema and seed loaded correctly.**
```bash
docker exec -i supabase_db_Salsa psql -U postgres -tAc \
  "select count(*) from public.events"                        # 6
docker exec -i supabase_db_Salsa psql -U postgres -tAc \
  "select count(*) from public.events where status='approved'" # 5
docker exec -i supabase_db_Salsa psql -U postgres -tAc \
  "select string_agg(column_name, ',' order by ordinal_position)
   from information_schema.columns
   where table_schema='public' and table_name='events'"
```
The column list must contain all 20 columns, ending with `city,host,recurrence,gallery` — proving the baseline and the incremental migration both applied. If the container name differs, get it from `docker ps --format '{{.Names}}' | grep supabase_db`.

**3. NEW behavior — PostgREST serves the app's exact query through RLS.** This is the check that proves the whole stack, not just the database:
```bash
KEY=$(grep '^VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=' .env.local | cut -d= -f2-)
curl -s "http://127.0.0.1:54321/rest/v1/events?select=title,status&status=eq.approved&city=eq.boston" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Expect a JSON array of exactly the **3 approved Boston** events. `Unapproved Test Social` must be absent — its absence is the proof that the SELECT policy is enforcing `status='approved'` rather than the endpoint returning everything.

**4. NEW behavior — anonymous insert is capped to `pending`.** Proves the Step 4 policy:
```bash
# Should SUCCEED (201):
curl -s -o /dev/null -w '%{http_code}\n' -X POST "http://127.0.0.1:54321/rest/v1/events" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"title":"RLS probe pending","event_date":"2027-01-01T20:00:00Z","status":"pending","city":"boston"}'

# Should FAIL with 403 (policy violation):
curl -s -X POST "http://127.0.0.1:54321/rest/v1/events" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"title":"RLS probe approved","event_date":"2027-01-01T20:00:00Z","status":"approved","city":"boston"}'
```
The second must be rejected with a row-level-security error. If it succeeds, the `with check (status = 'pending')` policy is not in effect.

**5. The app runs — the thing that was impossible before.**
```bash
npm run dev
```
Open `http://localhost:5173`. The home page and `/calendar` must render the seeded Boston events (not an error boundary, not an empty calendar). Switch the city to New York City and confirm the 2 NYC events appear and the Boston ones do not. `Unapproved Test Social` must never appear.

Then open `/submit`, fill and submit the form, and confirm a new row lands:
```bash
docker exec -i supabase_db_Salsa psql -U postgres -tAc \
  "select title, status from public.events where submitter_email <> 'seed@local.dev'"
```
The submitted row must be present with `status = pending` — end-to-end proof that the browser → PostgREST → Postgres write path works locally.

**6. Existing tests still pass.**
```bash
npm test -- --run
```
All 10 test files pass. They are pure/unit and none import the Supabase client, so this should be unaffected — a failure here means something in Steps 1–2 broke the Vite/Vitest config.

**7. devdb is untouched.** Salsa must not have disturbed the shared stack:
```bash
docker exec devdb psql -U postgres -tAc \
  "select datname from pg_database where datistemplate=false order by 1"
```
Expect exactly `piggy, postgres, salsatd, tambora` — no `salsa` database, confirming Salsa runs on its own Postgres.

**Teardown between sessions:** `npx supabase stop` (add `--no-backup` to discard local data). The stack is not set to auto-start, so it will not compete with devdb/piggy for memory when not in use.

## Assumptions & contingencies

- **The baseline migration is local-only and must NOT be pushed to production.** It is reconstructed from `Docs/sql queries/`, not dumped from the live database, because the hosted project's Postgres password is not available here (only the publishable key is, in `azure-env-setup.sh`). Running `supabase db push` or `supabase link` against production with an unverified baseline risks corrupting the live schema. Before ever adopting migrations as the deployment path, obtain the project's DB password and run `supabase db pull` to capture the true production schema, then reconcile it against Step 3's baseline. Until then, production keeps being changed by hand through the SQL editor exactly as it is today.
- **`supabase start` pulls ~5 images on first run.** Docker registry reachability and 204 GB free disk were confirmed. If the host runs short of memory with devdb + piggy also up (7.6 GiB total, ~4.5 GiB available, 2.6 GiB already swapped), stop the piggy stack for the session (`docker compose -f /home/r8s/code/piggy/compose.yaml stop`) rather than trimming Supabase further — `[auth]` and `[studio]` are the two services the next roadmap items depend on and should be the last to go.
- **The local anon/publishable key format may differ from production's `sb_publishable_…` shape.** Recent CLI versions emit a JWT-style anon key, a new-format publishable key, or both. Whichever `npx supabase status` labels for client use is correct for `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`; `createClient` accepts either. If `status` prints both a legacy `anon key` and a `publishable key`, prefer the publishable one to match production's shape.
- **`src/content/events/events.db3` is an orphaned, empty SQLite file** with zero references anywhere in the repo and a schema that does not match the live `events` table. It plays no part in this work; leave it alone.
- **Salsa's git tree is clean, on `main`, tracking `git@github.com:r8s11/Salsa.git`.** Unlike piggy, there is no uncommitted work to protect, so a feature branch is optional here.
- **WODCard is the remaining item** on the workspace backlog (`/home/r8s/code/TODO.md`: "Connect WOD to DB") and is not addressed by this plan. It is a FastAPI backend with no database driver installed and localStorage-only persistence, so it belongs on `devdb` like salsatd, not on a Supabase stack.
