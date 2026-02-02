# Supabase Setup Guide — Learning Notes

This guide explains how to set up Supabase as the backend database for your project, with practical commands, code snippets, and learning notes to help you move from local development to production. It covers account setup, local development with the Supabase CLI, database schema and migrations, authentication and Row-Level Security (RLS), storage, realtime, edge functions, backups, and best practices.

---

## Table of contents

- Overview & when to choose Supabase
- Prerequisites
- Create a Supabase project (cloud)
- Local development with Supabase CLI
- Database schema, migrations, and seeds
- Authentication and RLS (Row-Level Security)
- Storage (files) and policies
- Realtime and subscriptions
- Edge Functions (serverless) overview
- Backups, exports, and migrations
- Environment variables & secrets
- Monitoring, observability, and costs
- Security best practices
- Troubleshooting & common pitfalls
- Learning notes & references

---

## Overview & when to choose Supabase

- Supabase is an open-source Firebase alternative built on PostgreSQL with additional features: Auth, Storage, Realtime, Edge Functions, and a hosted dashboard.
- Use Supabase when you want:
  - A relational DB with SQL + realtime capabilities.
  - Quick prototyping with a managed backend.
  - Native Postgres extensions (e.g., full-text search) and the flexibility of SQL.

Learning note: Supabase shines for projects that need standard relational modeling with occasional realtime or auth features. For extreme scale or very specialized DB features, evaluate managed Postgres or other data stores.

---

## Prerequisites

- Node.js + npm or bun/pnpm installed for client examples and tooling.
- Git installed.
- A Supabase account (for hosted project). Sign up at https://supabase.com.
- Optional: Docker (the Supabase CLI uses Docker for local emulation).

---

## Create a Supabase project (hosted)

1. Sign in to Supabase and create a new project.
2. Choose a project name and password (this creates the DB user/password for the DB dashboard).
3. Record the project `URL` and `anon`/`service_role` keys from the Dashboard → Project Settings → API.

Important: Keep the `service_role` key secret — it bypasses RLS and should only be used on trusted servers.

Env vars you will use:

- `SUPABASE_URL` — the project URL (e.g., `https://xyzcompany.supabase.co`).
- `SUPABASE_ANON_KEY` — public, limited-privilege key suitable for client-side usage.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side secret, never expose in the browser.

---

## Local development with Supabase CLI

Install the Supabase CLI (official instructions at supabase.com):

- macOS (Homebrew):

```bash
brew install supabase/tap/supabase
```

- Or follow CLI install docs at https://supabase.com/docs/guides/cli

Common CLI commands (local emulation):

- `supabase login` — authenticate the CLI with your Supabase account.
- `supabase init` — initialize a new local project folder (creates `supabase/` dir).
- `supabase start` — start local Docker-based Supabase stack (Postgres, Kong, etc.).
- `supabase stop` — stop the local stack.
- `supabase status` — check local status.
- `supabase functions` — manage Edge Functions (deploy, local dev).

Learning note: The CLI runs services in Docker for faithful local testing. Use `supabase start` to run a self-contained environment similar to hosted Supabase.

---

## Database schema, migrations, and seeds

Approach options:

- SQL-first: Keep plain SQL migration files under `supabase/migrations` and apply with the CLI.
- GUI-first: Use the dashboard SQL editor then export or snapshot schema and create SQL migration files for source control.

Example: Create a `profiles` table and enable RLS

```sql
-- 001_create_profiles.sql
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
```

Add a policy so users can manage their own profile:

```sql
create policy "Users can manage own profile"
  on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

Learning note: Policies are enforced only when RLS is enabled. Test policies with both session-based JWTs and with the `service_role` key to ensure correctness.

Migrations & workflow tips:

- Keep migrations in source control (one SQL file per migration).
- Use a consistent naming scheme like `YYYYMMDD_HHMMSS_description.sql` or `001_description.sql`.
- Test migrations locally with `supabase start` and applying the SQL files.
- For production, prefer applying migrations via the CLI or CI/CD to avoid drift.

---

## Authentication and Row-Level Security (RLS)

Auth basics:

- Supabase Auth issues JWTs for users. Use the client-side `anon` key for public actions, and server-side `service_role` for privileged server operations.
- The JWT contains `sub` as the user's UUID; use `auth.uid()` in policies to get the current user ID in RLS.

Common RLS pattern for user-owned rows:

- Enable RLS on the table: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- Create policies using `auth.uid()` in `USING` and `WITH CHECK` clauses.

Example policy allowing any authenticated user to create their own `profiles` row but only modify their own row:

```sql
create policy "Insert own profile" on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "Update own profile" on public.profiles
  for update
  using (auth.uid() = id);
```

Learning note: RLS can be tricky. Always test both `select`, `insert`, `update`, and `delete` behavior from client and server contexts. Use the SQL editor with `SET LOCAL role` or simulate JWTs when testing.

---

## Storage (file uploads)

- Supabase Storage provides S3-like buckets for file storage.
- Create buckets in the Dashboard and set bucket policies. Public or private buckets are available.
- Use the client SDK to upload/download files. For private buckets, generate signed URLs from server-side code.

Example upload (JS):

```js
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Upload a file
const { data, error } = await supabase.storage
  .from("avatars")
  .upload("public/user123/avatar.png", file);
```

Learning note: For sensitive uploads or for policy-protected access, prefer generating signed URLs on the server using the `service_role` key.

---

## Realtime and subscriptions

- Supabase offers realtime subscriptions using Postgres replication + websockets.
- Use `supabase.from('table').on('INSERT', payload => ...)` in the client SDK to listen for changes.

Example (JS):

```js
const channel = supabase
  .channel("public:messages")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages" },
    (payload) => {
      console.log("New message:", payload.new);
    }
  )
  .subscribe();
```

Learning note: Realtime is excellent for collaborative and live features, but consider scaling implications and use targeted channels/filters to limit unnecessary traffic.

---

## Edge Functions (serverless)

- Supabase Edge Functions run Deno-based serverless functions close to the user.
- Use them for server-side logic that needs `service_role` privileges or to keep secrets out of the browser.

Common uses:

- Webhooks receivers
- Authenticated server logic (send emails, process payments)
- Signed URL generation for private storage

Example workflow:

1. `supabase functions new hello`
2. Implement logic locally.
3. `supabase functions deploy hello`

Learning note: Keep functions small and focused. Treat them as secure entry points for trusted operations.

---

## Backups, exports, and migrations

- For hosted projects, Supabase provides backups and a DB dump feature in the dashboard.
- Regularly export schema and data snapshots and store them offsite (S3/GCS).
- For larger migrations, prefer testing schema changes locally and then apply via migration SQL files in a controlled CI pipeline.

Quick export idea (SQL dump): use the dashboard or `pg_dump` with connection details (host, port, db, user, password). Keep credentials secure.

---

## Environment variables & secrets

- Client: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (safe to include in frontend builds).
- Server: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (must be kept secret, store in CI secrets or server env).

Example `.env` (do NOT commit):

```
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

Learning note: Rotate `service_role` keys if they get exposed and use short-lived tokens where possible for external services.

---

## Monitoring, observability, and costs

- Use Supabase Dashboard metrics to watch database connections, query performance, and bandwidth.
- Use logs from Edge Functions and the Postgres logs for slow queries.
- Estimate costs: read/write RUs are not gated like some DBs, but storage, outbound bandwidth, and compute for edge functions can add costs. Monitor and set alerts.

---

## Security best practices

- Never expose `service_role` in frontend code or public repos.
- Use RLS extensively to minimize blast radius.
- Validate inputs in Edge Functions and server logic.
- Limit public bucket exposure; prefer signed URLs for private assets.
- Apply least privilege to any API keys and rotate keys periodically.

---

## Troubleshooting & common pitfalls

- "It works in the dashboard but not client-side": check RLS policies and the JWT used by the client.
- "Data drift between environments": keep migrations in source control and apply them via CI to avoid manual edits in production.
- Slow queries: inspect query plans in Postgres (`EXPLAIN ANALYZE`) and add indexes where appropriate.
- Local dev issues: ensure Docker is running and `supabase start` finished without errors.

---

## Learning notes (practical tips)

- Start small: model a `profiles` table and associated policies first; get auth → profiles → simple RLS working end-to-end before adding complex joins.
- Use the SQL editor in the Dashboard for quick experiments, but export SQL to migrations afterwards.
- Favor parameterized SQL and prepared statements in server-side code to avoid SQL injection.
- Use TypeScript on the client and generate types for tables (or write minimal types) to reduce bugs.
- Add meaningful constraints and indexes early to avoid expensive refactors later.

---

## Example minimal client usage (JS/TS)

```js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// sign up / sign in
await supabase.auth.signUp({ email: "me@example.com", password: "password" });

// query
const { data, error } = await supabase.from("profiles").select("*");
```

Server-side (Node) example for a protected operation:

```js
import { createClient } from '@supabase/supabase-js'
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Use admin client for privileged ops (e.g., server-side user import)
const { data, error } = await supabaseAdmin.from('payments').insert([{ user_id: ..., amount: 100 }])
```

Learning note: Use the admin client only on safe server contexts.

---

## References & further reading

- Supabase official docs: https://supabase.com/docs
- SQL and Postgres best practices (indexes, query planning)
- RLS and policies: practice in a sandbox project before applying to production tables

---

If you'd like, I can:

- Convert these examples into ready-to-run migration files under `supabase/migrations/`.
- Add a small seed script for sample data.
- Add a short CI snippet showing how to run migrations during deploy.

<!-- End of file -->
