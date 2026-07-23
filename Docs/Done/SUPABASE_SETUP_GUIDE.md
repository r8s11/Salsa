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

**Step-by-step:**

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" and sign up (GitHub recommended)
3. Click "New Project" in the dashboard
4. Fill in project details:
   - **Name:** Your project name (e.g., `salsasegura`)
   - **Password:** Generate a strong password and **save it securely**
   - **Region:** Choose closest to your users
5. Click "Create new project" and wait ~2 minutes
6. Go to **Settings → API** to find your keys
7. Copy the **Project URL** and **anon public** key

**Important:** Keep the `service_role` key secret — it bypasses RLS and should only be used on trusted servers.

Env vars you will use:

- `SUPABASE_URL` — the project URL (e.g., `https://xyzcompany.supabase.co`).
- `SUPABASE_ANON_KEY` — public, limited-privilege key suitable for client-side usage.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side secret, never expose in the browser.

---

## Local development with Supabase CLI

**Step-by-step to set up local development:**

1. Install the Supabase CLI:

   ```bash
   # macOS (Homebrew)
   brew install supabase/tap/supabase
   ```

   Or follow CLI install docs at https://supabase.com/docs/guides/cli

2. Login to your Supabase account:

   ```bash
   supabase login
   ```

3. Initialize a new local project:

   ```bash
   supabase init
   ```

4. Start the local Supabase stack:

   ```bash
   supabase start
   ```

5. When done, stop the local stack:
   ```bash
   supabase stop
   ```

**Common CLI commands:**

- `supabase status` — Check local status
- `supabase functions` — Manage Edge Functions

Learning note: The CLI runs services in Docker for faithful local testing. Use `supabase start` to run a self-contained environment similar to hosted Supabase.

---

## Database schema, migrations, and seeds

**Step-by-step to create a migration:**

1. Create a `supabase/migrations` folder in your project:

   ```bash
   mkdir -p supabase/migrations
   ```

2. Create a migration file with a descriptive name:

   ```bash
   touch supabase/migrations/001_create_profiles.sql
   ```

3. Add your SQL to the migration file (see example below)

4. Apply the migration locally:

   ```bash
   supabase db push
   ```

5. Or apply via the Supabase Dashboard SQL Editor for hosted projects

**Approach options:**

- **SQL-first:** Keep plain SQL migration files under `supabase/migrations` and apply with the CLI.
- **GUI-first:** Use the dashboard SQL editor then export or snapshot schema and create SQL migration files for source control.

**Example: Create a `profiles` table and enable RLS**

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

> 💡 **SQL Learning Note — CREATE TABLE Syntax**
>
> SQL is the language for talking to databases. Here's what each part means:
>
> ```sql
> create table public.profiles (
> --           │      └── Table name
> --           └── Schema (like a folder for tables)
>
>   id uuid primary key default gen_random_uuid(),
> -- │  │    │            └── Auto-generate a unique ID
> -- │  │    └── "This column uniquely identifies each row"
> -- │  └── Data type: UUID (universally unique identifier)
> -- └── Column name
>
>   email text unique not null,
> --             │      └── Can't be empty/missing
> --             └── No two rows can have the same email
>
>   full_name text,  -- Optional (no "not null")
> );
> ```
>
> **Common data types:**
> | Type | Description | Example |
> |------|-------------|---------|
> | `text` | Any string | "Hello World" |
> | `uuid` | Unique ID | "a1b2c3..." |
> | `timestamptz` | Date + time + timezone | "2026-02-03 10:30:00-05" |
> | `integer` | Whole number | 42 |
> | `numeric(10,2)` | Decimal (10 digits, 2 after point) | 99.99 |

Add a policy so users can manage their own profile:

```sql
create policy "Users can manage own profile"
  on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

> 💡 **SQL Learning Note — Row Level Security (RLS)**
>
> RLS is like a bouncer for your database — it controls who can see/edit what.
>
> ```sql
> create policy "Policy name"    -- Descriptive name
>   on public.profiles           -- Which table
>   for all                      -- SELECT, INSERT, UPDATE, DELETE (or pick one)
>   using (auth.uid() = id)      -- WHO can read existing rows?
>   with check (auth.uid() = id) -- WHO can write new/changed rows?
> ```
>
> **What `auth.uid()` returns:**
>
> - The logged-in user's ID (from their JWT token)
> - `null` if not logged in
>
> **How it works:**
>
> ```
> User "abc123" tries to SELECT from profiles
> ↓
> For each row, evaluate: auth.uid() = id
> ↓
> Row with id="abc123" → TRUE → User CAN see it
> Row with id="xyz789" → FALSE → User CANNOT see it
> ```
>
> **Common policy patterns:**
> | Pattern | Use case |
> |---------|-----------|
> | `auth.uid() = user_id` | Users manage their own data |
> | `true` | Anyone can read (public data) |
> | `auth.role() = 'admin'` | Admin-only access |

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

> 💡 **React Learning Note — Passing Data with Props**
>
> **Props** (properties) pass data from parent to child components:
>
> ```tsx
> // Parent component
> function ProfilePage() {
>   const avatarUrl = "https://example.com/avatar.png";
>   return <Avatar imageUrl={avatarUrl} size={100} />;
>   //              └───────────────────────┘
>   //              Props: key={value} pairs
> }
>
> // Child component receives props
> function Avatar({ imageUrl, size }) {
>   //            └───────────────┘
>   //            Destructure from props object
>   return <img src={imageUrl} width={size} />;
> }
>
> // With TypeScript:
> interface AvatarProps {
>   imageUrl: string;
>   size: number;
> }
>
> function Avatar({ imageUrl, size }: AvatarProps) {
>   return <img src={imageUrl} width={size} />;
> }
> ```
>
> **Props are read-only!**
> Components can't modify their props — they can only read them.
> To change data, use state in the parent and pass it down.

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

> 💡 **JS/TS Learning Note — Chaining Methods**
>
> **Method chaining** lets you call multiple methods in a row:
>
> ```javascript
> supabase
>   .channel("public:messages")  // Returns an object with .on() method
>   .on(...)                      // Returns an object with .subscribe() method
>   .subscribe();                 // Starts listening
> ```
>
> **It's equivalent to:**
>
> ```javascript
> const step1 = supabase.channel("public:messages");
> const step2 = step1.on(...);
> const step3 = step2.subscribe();
> ```
>
> **Callback functions:**
>
> ```javascript
> .on("postgres_changes", { event: "INSERT"... }, (payload) => {
>   console.log("New message:", payload.new);
> })
> //                                             └────────────────────────────┘
> //                                             This function runs LATER,
> //                                             when a new message is inserted
> ```
>
> This is called a **callback** — code that runs when something happens.

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

> 💡 **JS/TS Learning Note — Environment Variables**
>
> Environment variables store secrets and config **outside** your code:
>
> ```
> # .env file (local development)
> DATABASE_PASSWORD=super_secret_123
> API_KEY=abc123xyz
> ```
>
> **Accessing them in code:**
>
> ```javascript
> // Node.js / Server
> process.env.SUPABASE_URL;
>
> // Vite (browser)
> import.meta.env.VITE_SUPABASE_URL; // Must start with VITE_
> ```
>
> **Why `.env` files?**
>
> - ✅ Secrets stay out of git history
> - ✅ Different values per environment (dev vs production)
> - ✅ Easy to change without editing code
>
> **Critical:** Add `.env` to `.gitignore` so it's never committed!

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

> 💡 **JS/TS Learning Note — Destructuring**
>
> **Destructuring** extracts values from objects or arrays:
>
> ```javascript
> // Without destructuring
> const result = await supabase.from("profiles").select("*");
> const data = result.data;
> const error = result.error;
>
> // With destructuring (same thing, shorter)
> const { data, error } = await supabase.from("profiles").select("*");
> ```
>
> **More examples:**
>
> ```javascript
> // Object destructuring
> const user = { name: "Ana", age: 28 };
> const { name, age } = user; // name = "Ana", age = 28
>
> // Array destructuring (useState uses this!)
> const [first, second] = ["a", "b"]; // first = "a", second = "b"
> const [count, setCount] = useState(0); // React!
>
> // Renaming while destructuring
> const { data: profiles } = await supabase.from("profiles").select("*");
> // profiles = the data, original name "data" not used
> ```

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
