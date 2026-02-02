# Phase 3: Database Backend with Supabase

> **Deliverable:** Dynamic event storage and retrieval from PostgreSQL database
> **Time Commitment:** 10-12 hours (spread across 6 days)
> **Prerequisites:** Phases 1-2 completed, basic understanding of APIs and async JavaScript

---

## 🎯 Phase 3 Objectives

By the end of this phase, you will have:

- [ ] Supabase account created and project configured
- [ ] PostgreSQL database schema designed and created
- [ ] React app connected to Supabase
- [ ] Events fetched from database and displayed on calendar
- [ ] Environment variables configured for security
- [ ] Dual event sources working (markdown + database)

---

## 📚 Concepts You'll Learn

| Concept                               | Why It Matters                                 |
| ------------------------------------- | ---------------------------------------------- |
| **Backend as a Service (BaaS)** | Build full-stack apps without managing servers |
| **PostgreSQL**                  | Industry-standard relational database          |
| **RESTful APIs**                | How frontend talks to backend                  |
| **Async JavaScript**            | Fetch data without blocking the UI             |
| **Environment Variables**       | Keep API keys secure                           |
| **Data Modeling**               | Design database schemas that scale             |

---

## 🗂️ Target File Structure

After this phase, your `src/` folder should include:

```
src/
├── lib/
│   └── supabase.ts              # 🆕 Supabase client configuration
├── hooks/
│   ├── useEvents.ts             # 🆕 Combined events hook
│   └── useMarkdownEvents.ts     # ✅ Existing markdown hook
├── types/
│   └── events.ts                # ✏️ Updated with database types
├── components/
│   └── calendar.tsx             # ✏️ Updated to use useEvents
└── .env.local                   # 🆕 Environment variables (gitignored!)
```

---

## 📖 Understanding Backend as a Service (BaaS)

### What is Supabase?

Supabase is an **open-source Firebase alternative** that provides:

- **PostgreSQL Database** - Relational database with SQL
- **Auto-generated APIs** - REST and GraphQL endpoints
- **Authentication** - User login/signup (we'll use in Phase 5)
- **Storage** - File uploads (we'll use in Phase 4)
- **Real-time** - Live data updates (advanced feature)

### Why Supabase over Building Your Own Backend?

| Traditional Backend           | Supabase BaaS               |
| ----------------------------- | --------------------------- |
| Set up Node.js/Express server | ✅ Already done             |
| Write API endpoints manually  | ✅ Auto-generated           |
| Manage database migrations    | ✅ Built-in migration tools |
| Handle authentication         | ✅ Built-in auth system     |
| Deploy and scale servers      | ✅ Hosted and auto-scaled   |
| **Time:** Weeks         | **Time:** Hours       |

**Analogy:** Building your own backend is like building a car from scratch. Supabase is like buying a Tesla - it comes with everything you need, fully assembled.

---

## Day 1: Create Supabase Account & Project (2 hours)

### Step 1.1: Sign Up for Supabase

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"**
3. Sign up with GitHub (recommended) or email
4. Verify your email

**💡 Learning Note:** Signing up with GitHub enables automatic CI/CD integration later.

### Step 1.2: Create a New Project

1. Click **"New Project"**
2. Fill in the project details:

   - **Name:** `salsasegura` (or your preference)
   - **Database Password:** Generate a strong password and **save it somewhere safe!**
   - **Region:** Choose closest to your users (e.g., `US East (Ohio)` for Boston)
   - **Pricing Plan:** Free (includes 500MB database, 1GB file storage, 2GB bandwidth)
3. Click **"Create new project"**
4. Wait ~2 minutes for provisioning

**💡 Learning Note - Database Regions:**

Database region affects **latency** (response time). The closer the database is to your users, the faster queries run.

| Region             | Best For       | Latency from Boston |
| ------------------ | -------------- | ------------------- |
| US East (Ohio)     | East Coast USA | ~20ms               |
| US West (Oregon)   | West Coast USA | ~80ms               |
| Europe (Frankfurt) | Europe         | ~100ms              |

### Step 1.3: Get Your API Keys

Once your project is ready:

1. Click **"Settings"** in the left sidebar
2. Click **"API"** under Project Settings
3. You'll see two important keys:

| Key                    | Purpose           | When to Use                  |
| ---------------------- | ----------------- | ---------------------------- |
| **Project URL**  | Your API endpoint | All requests                 |
| **anon public**  | Public API key    | Frontend (safe to expose)    |
| **service_role** | Admin key         | Backend only (NEVER expose!) |

**🔒 CRITICAL SECURITY NOTE:**

- ✅ **anon public** key - Safe for frontend, read-only by default
- ❌ **service_role** key - Never put in frontend code! Has full admin access

Copy both the **Project URL** and **anon public** key - we'll use them in Step 1.4.

### Step 1.4: Create Environment Variables File

In your project root (same level as `package.json`), create a file named `.env.local`:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Replace** `your-project-id` and `your-anon-key-here` with your actual values from Step 1.3.

**💡 Learning Note - Environment Variables:**

Environment variables are values stored **outside your code** for security and flexibility.

**Why use them?**

- ✅ Keep secrets out of git (API keys, passwords)
- ✅ Different values per environment (dev, staging, production)
- ✅ Easy to change without editing code

**Vite prefix requirement:**
Vite (your build tool) only exposes variables starting with `VITE_` to the frontend. This prevents accidentally leaking backend-only secrets.

### Step 1.5: Add .env.local to .gitignore

Open `.gitignore` and ensure it includes:

```
# Environment variables
.env.local
.env*.local
```

**🔒 CRITICAL:** Never commit `.env.local` to git! This file contains your API keys.

### Step 1.6: Install Supabase JavaScript Client

In your terminal, run:

```bash
npm install @supabase/supabase-js
```

This installs the official Supabase client library for JavaScript/TypeScript.

### ✅ Day 1 Checkpoint

You should now have:

- [X] Supabase account created
- [X] Project provisioned and running
- [X] API keys saved
- [X] `.env.local` file created with keys
- [X] `.gitignore` protecting `.env.local`
- [X] `@supabase/supabase-js` installed

**Test:** Run `npm run dev` - your app should still work (we haven't broken anything yet!).

---

## Day 2: Design & Create Database Schema (2 hours)

### Step 2.1: Understanding Database Schema Design

A **database schema** is the blueprint of your database - it defines:

- What tables exist
- What columns each table has
- What data types each column stores
- Relationships between tables

**💡 Learning Note - Relational Database Concepts:**

| Concept               | Analogy            | Example                              |
| --------------------- | ------------------ | ------------------------------------ |
| **Table**       | Spreadsheet        | `events` table                     |
| **Column**      | Spreadsheet column | `title`, `date`, `location`    |
| **Row**         | Spreadsheet row    | One event                            |
| **Primary Key** | Unique ID          | `id` (identifies each row)         |
| **Data Type**   | Column format      | `text`, `integer`, `timestamp` |

### Step 2.2: Event Data Model

Let's design what information we need to store for each event:

| Field            | Type      | Purpose                   | Required?            |
| ---------------- | --------- | ------------------------- | -------------------- |
| `id`           | UUID      | Unique identifier         | ✅ Auto-generated    |
| `title`        | Text      | Event name                | ✅                   |
| `description`  | Text      | Event details             | ❌ Optional          |
| `event_type`   | Text      | Social/Workshop/Class     | ✅                   |
| `event_date`   | Timestamp | When it happens           | ✅                   |
| `event_time`   | Text      | Human-readable time       | ❌ Optional          |
| `location`     | Text      | Venue name                | ❌ Optional          |
| `address`      | Text      | Street address            | ❌ Optional          |
| `price_type`   | Text      | Free or Paid              | ❌ Optional          |
| `price_amount` | Numeric   | Cost in dollars           | ❌ Optional          |
| `rsvp_link`    | Text      | Registration URL          | ❌ Optional          |
| `image_url`    | Text      | Event poster URL          | ❌ Optional          |
| `status`       | Text      | Approved/Pending/Rejected | ✅ Default: approved |
| `created_at`   | Timestamp | When row was created      | ✅ Auto-generated    |

**💡 Learning Note - Data Types Explained:**

| SQL Data Type | JavaScript Equivalent       | Example                                    |
| ------------- | --------------------------- | ------------------------------------------ |
| `text`      | `string`                  | `"Salsa Night"`                          |
| `integer`   | `number` (whole)          | `42`                                     |
| `numeric`   | `number` (decimal)        | `19.99`                                  |
| `timestamp` | `Date`                    | `2026-01-15 20:00:00`                    |
| `uuid`      | `string` (special format) | `"550e8400-e29b-41d4-a716-446655440000"` |
| `boolean`   | `boolean`                 | `true` / `false`                       |

**UUID (Universally Unique Identifier):**
A 128-bit number guaranteed to be unique. Much better than auto-incrementing integers because:

- Can't guess other IDs (security)
- No conflicts when merging databases
- Can generate client-side without database

### Step 2.3: Create the Events Table

In Supabase dashboard:

1. Click **"SQL Editor"** in the left sidebar
2. Click **"+ New query"**
3. Paste the following SQL:

```sql
-- Create events table
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text check (event_type in ('social', 'workshop', 'class')),
  event_date timestamp with time zone not null,
  event_time text,
  location text,
  address text,
  price_type text check (price_type in ('free', 'paid')),
  price_amount numeric(10, 2),
  rsvp_link text,
  image_url text,
  status text default 'approved',
  created_at timestamp with time zone default now()
);

-- Create index on event_date for faster queries
create index events_event_date_idx on public.events (event_date);

-- Enable Row Level Security (we'll configure in Phase 5)
alter table public.events enable row level security;

-- For now, allow public read access to approved events
create policy "Public events are viewable by everyone"
  on public.events
  for select
  using (status = 'approved');

-- Allow inserting events (we'll restrict this in Phase 5)
create policy "Anyone can insert events"
  on public.events
  for insert
  with check (true);
```

4. Click **"Run"** (or press Ctrl/Cmd + Enter)
5. You should see "Success. No rows returned"

**💡 Learning Note - SQL Explained:**

Let's break down this SQL statement line by line:

```sql
create table public.events (
```

- `create table` - Make a new table
- `public.events` - In the `public` schema, name it `events`
- `(` - Start listing columns

```sql
  id uuid primary key default gen_random_uuid(),
```

- `id` - Column name
- `uuid` - Data type (unique identifier)
- `primary key` - This column uniquely identifies each row
- `default gen_random_uuid()` - Auto-generate a random UUID when inserting

```sql
  title text not null,
```

- `text` - Can store any length of text
- `not null` - This field is required (can't be empty)

```sql
  event_type text check (event_type in ('social', 'workshop', 'class')),
```

- `check (...)` - **Constraint** that enforces only these three values are allowed
- This prevents typos like `'socail'` or `'clase'`

```sql
  event_date timestamp with time zone not null,
```

- `timestamp with time zone` - Stores date AND time with timezone info
- Automatically converts to UTC internally
- Important for handling events across timezones

```sql
  price_amount numeric(10, 2),
```

- `numeric(10, 2)` - Number with up to 10 total digits, 2 after decimal
- Can store: `99999999.99` but not `999999999.99` (too many digits)
- Better than `float` for money (no rounding errors!)

```sql
  created_at timestamp with time zone default now()
```

- `default now()` - Automatically set to current time when row is created
- No trailing comma - this is the last column

```sql
create index events_event_date_idx on public.events (event_date);
```

- **Index** = Sorted lookup table for faster queries
- Like a book's index - makes finding dates much faster
- Without index: Database scans entire table
- With index: Database jumps directly to matching rows

```sql
alter table public.events enable row level security;
```

- **Row Level Security (RLS)** - Database-level access control
- Each row can have different permissions
- Example: Users can only see their own events, admins see all

```sql
create policy "Public events are viewable by everyone"
  on public.events
  for select
  using (status = 'approved');
```

- **Policy** - Rule that defines who can access which rows
- `for select` - Applies to read operations
- `using (status = 'approved')` - Only show rows where status is approved
- Hidden events (pending/rejected) won't be returned in queries

### Step 2.4: Verify Table Creation

1. Click **"Table Editor"** in left sidebar
2. You should see `events` table
3. Click on it - you'll see all your columns
4. It's empty (no rows yet) - that's expected!

### Step 2.5: Add Test Data

Let's add some sample events. In SQL Editor, run:

```sql
insert into public.events (title, description, event_type, event_date, event_time, location, address, price_type, rsvp_link)
values
  (
    'Friday Night Salsa Social',
    'Join us for a night of salsa dancing! All levels welcome.',
    'social',
    '2026-01-30 20:00:00-05:00',
    '8:00 PM - 12:00 AM',
    'Havana Club Boston',
    '456 Commonwealth Ave, Boston, MA 02215',
    'paid',
    'https://example.com/rsvp-friday-social'
  ),
  (
    'Beginner Salsa Workshop',
    'Learn the fundamentals of salsa dancing in this 2-hour workshop.',
    'workshop',
    '2026-02-01 14:00:00-05:00',
    '2:00 PM - 4:00 PM',
    'Dance Studio Boston',
    '123 Boylston St, Boston, MA 02116',
    'paid',
    'https://example.com/beginner-workshop'
  ),
  (
    'Intermediate Salsa Class',
    'Take your salsa to the next level with advanced turn patterns.',
    'class',
    '2026-02-05 19:00:00-05:00',
    '7:00 PM - 8:00 PM',
    'Latin Dance Academy',
    '789 Newbury St, Boston, MA 02115',
    'paid',
    'https://example.com/intermediate-class'
  );
```

**💡 Learning Note - INSERT Statement:**

```sql
insert into public.events (column1, column2, ...)
values (value1, value2, ...);
```

- Lists which columns to fill
- `values` provides the data
- Order must match column list
- Strings use single quotes `'like this'`
- Timestamps include timezone: `-05:00` is EST

### Step 2.6: Query Your Data

Let's verify the data was inserted. Run:

```sql
select * from public.events order by event_date;
```

You should see your 3 test events!

**💡 Learning Note - SELECT Statement:**

```sql
select * from public.events order by event_date;
```

- `select *` - Get all columns
- `from public.events` - From this table
- `order by event_date` - Sort by date (oldest first)

Common variations:

```sql
select title, event_date from events;  -- Only these columns
select * from events where event_type = 'social';  -- Filter
select count(*) from events;  -- Count rows
select * from events limit 10;  -- First 10 rows
```

### ✅ Day 2 Checkpoint

You should now have:

- [X] Events table created with proper schema
- [X] Indexes for performance
- [X] Row Level Security enabled
- [X] 3 test events inserted
- [X] Verified data in Table Editor

---

## Day 3: Connect React to Supabase (3 hours)

### Step 3.1: Create Supabase Client

Create file: `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables exist
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check your .env.local file.'
  );
}

// Create and export Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**💡 Learning Note - import.meta.env:**

`import.meta.env` is how Vite exposes environment variables to your code.

```typescript
import.meta.env.VITE_SUPABASE_URL  // Access env variable
import.meta.env.MODE  // "development" or "production"
import.meta.env.DEV   // true in development
import.meta.env.PROD  // true in production
```

**Why validate variables exist?**
If someone clones your repo without setting up `.env.local`, they'll get a clear error message instead of cryptic runtime errors.

### Step 3.2: Define Database Types

Update `src/types/events.ts` to add database types:

```typescript
import 'temporal-polyfill/global';

// Event types for the calendar (used as calendarId in Schedule-X)
export type EventType = 'social' | 'class' | 'workshop';

// Database event interface (matches Supabase schema)
export interface DatabaseEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  event_date: string;  // ISO timestamp from database
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: 'free' | 'paid' | null;
  price_amount: number | null;
  rsvp_link: string | null;
  image_url: string | null;
  status: 'approved' | 'pending' | 'rejected';
  created_at: string;
}

// Schedule-X event interface (what the calendar needs)
export interface ScheduleXEvent {
  id: string | number;
  title: string;
  start: string;  // "YYYY-MM-DD HH:mm" format
  end: string;
  calendarId: EventType;
  location?: string;
  description?: string;
  address?: string;
  rsvpLink?: string;
}

// Existing calendar configuration
export const CALENDARS_CONFIG = {
  social: {
    colorName: 'social',
    lightColors: {
      main: '#ff8c42',
      container: '#ffe4d1',
      onContainer: '#5c2e00',
    },
    darkColors: {
      main: '#ffb380',
      container: '#8b4513',
      onContainer: '#ffe4d1',
    },
  },
  class: {
    colorName: 'class',
    lightColors: {
      main: '#3498db',
      container: '#d6eaf8',
      onContainer: '#1a4a6e',
    },
    darkColors: {
      main: '#85c1e9',
      container: '#2471a3',
      onContainer: '#d6eaf8',
    },
  },
  workshop: {
    colorName: 'workshop',
    lightColors: {
      main: '#27ae60',
      container: '#d5f5e3',
      onContainer: '#145a32',
    },
    darkColors: {
      main: '#82e0aa',
      container: '#1e8449',
      onContainer: '#d5f5e3',
    },
  },
};

// Convert database event to Schedule-X event
export function databaseEventToScheduleX(event: DatabaseEvent): ScheduleXEvent {
  // Parse the ISO timestamp
  const eventDate = new Date(event.event_date);

  // Format as "YYYY-MM-DD HH:mm"
  const start = formatDateTimeForScheduleX(eventDate);

  // Assume 2 hour duration if not specified
  const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
  const end = formatDateTimeForScheduleX(endDate);

  return {
    id: event.id,
    title: event.title,
    start,
    end,
    calendarId: event.event_type,
    location: event.location ?? undefined,
    description: event.description ?? undefined,
    address: event.address ?? undefined,
    rsvpLink: event.rsvp_link ?? undefined,
  };
}

// Helper to format Date as "YYYY-MM-DD HH:mm"
function formatDateTimeForScheduleX(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Helper to create a ZonedDateTime for Boston timezone (kept for future use)
export function bostonDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number = 0
): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.from({
    year,
    month,
    day,
    hour,
    minute,
    second: 0,
    timeZone: 'America/New_York',
  });
}
```

**💡 Learning Note - Type Safety:**

TypeScript interfaces ensure type safety between database and frontend:

```typescript
interface DatabaseEvent {
  event_type: EventType;  // ✅ Only 'social' | 'class' | 'workshop'
  price_amount: number | null;  // ✅ Can be number OR null
}

const event: DatabaseEvent = {
  event_type: 'party',  // ❌ TypeScript error! Not a valid EventType
  price_amount: 'free',  // ❌ TypeScript error! Should be number or null
};
```

**The `| null` pattern:**

In SQL, columns can be `NULL` (no value). TypeScript represents this as:

```typescript
location: string | null  // Can be "Havana Club" OR null
```

The `??` operator provides defaults:

```typescript
location: event.location ?? undefined  // If null, use undefined instead
```

### Step 3.3: Create Supabase Events Hook

Create file: `src/hooks/useSupabaseEvents.ts`

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DatabaseEvent, ScheduleXEvent, databaseEventToScheduleX } from '../types/events';

export function useSupabaseEvents() {
  const [events, setEvents] = useState<ScheduleXEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        setError(null);

        // Query Supabase for approved events
        const { data, error: fetchError } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'approved')  // Only approved events
          .gte('event_date', new Date().toISOString())  // Only future events
          .order('event_date', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        // Convert database events to Schedule-X format
        const scheduleXEvents = (data as DatabaseEvent[]).map(databaseEventToScheduleX);
        setEvents(scheduleXEvents);
      } catch (err) {
        console.error('Error fetching events from Supabase:', err);
        setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);  // Empty dependency array = run once on mount

  return { events, loading, error };
}
```

**💡 Learning Note - Supabase Query API:**

Supabase provides a JavaScript query builder that mirrors SQL:

```typescript
await supabase
  .from('events')              // SELECT * FROM events
  .select('*')                 // Get all columns
  .eq('status', 'approved')    // WHERE status = 'approved'
  .gte('event_date', date)     // AND event_date >= date
  .order('event_date', { ascending: true });  // ORDER BY event_date ASC
```

**Common query methods:**

| Method              | SQL Equivalent         | Example                                 |
| ------------------- | ---------------------- | --------------------------------------- |
| `.eq(col, val)`   | `WHERE col = val`    | `.eq('type', 'social')`               |
| `.neq(col, val)`  | `WHERE col != val`   | `.neq('status', 'rejected')`          |
| `.gt(col, val)`   | `WHERE col > val`    | `.gt('price', 0)`                     |
| `.gte(col, val)`  | `WHERE col >= val`   | `.gte('date', today)`                 |
| `.lt(col, val)`   | `WHERE col < val`    | `.lt('capacity', 100)`                |
| `.lte(col, val)`  | `WHERE col <= val`   | `.lte('price', 50)`                   |
| `.in(col, array)` | `WHERE col IN (...)` | `.in('type', ['social', 'class'])`    |
| `.is(col, val)`   | `WHERE col IS val`   | `.is('location', null)`               |
| `.order(col)`     | `ORDER BY col`       | `.order('date', { ascending: true })` |
| `.limit(n)`       | `LIMIT n`            | `.limit(10)`                          |

**Error handling pattern:**

```typescript
const { data, error } = await supabase.from('events').select('*');

if (error) {
  // Handle error
  throw error;
}

// Use data safely
console.log(data);
```

Supabase returns `{ data, error }` - always check for errors:

### Step 3.4: Test Supabase Connection

Let's create a simple test component to verify everything works.

Create file: `src/components/SupabaseTest.tsx`:

```typescript
import { useSupabaseEvents } from '../hooks/useSupabaseEvents';

function SupabaseTest() {
  const { events, loading, error } = useSupabaseEvents();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading events from Supabase...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'red', textAlign: 'center' }}>
        <h3>Error loading events</h3>
        <p>{error}</p>
        <p>Check your .env.local file and Supabase configuration.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Supabase Events Test</h2>
      <p>Found {events.length} events</p>
      <ul>
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.title}</strong> - {event.start}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SupabaseTest;
```

Temporarily add this to your `HomePage.tsx`:

```typescript
import Hero from '../components/Hero';
import Events from '../components/Events';
import SupabaseTest from '../components/SupabaseTest';  // Add this

function HomePage() {
  return (
    <>
      <Hero />
      <SupabaseTest />  {/* Add this */}
      <Events />
    </>
  );
}

export default HomePage;
```

Run `npm run dev` and check the homepage. You should see your 3 test events listed!

**If you see an error:**

1. Check `.env.local` exists with correct values
2. Verify Supabase project is running (not paused)
3. Check browser console for detailed errors
4. Ensure RLS policies allow public read access

**Once it works, remove `<SupabaseTest />` from HomePage.tsx.**

### ✅ Day 3 Checkpoint

You should now have:

- [X] Supabase client configured (`src/lib/supabase.ts`)
- [X] Database types defined (`src/types/events.ts`)
- [X] Custom hook to fetch events (`src/hooks/useSupabaseEvents.ts`)
- [X] Successfully fetched and displayed events from Supabase

---

## Day 4: Combine Markdown + Database Events (2 hours)

### Step 4.1: Create Unified Events Hook

Now we'll create a hook that combines events from both sources.

Create file: `src/hooks/useEvents.ts`:

```typescript
import { useState, useEffect } from 'react';
import { ScheduleXEvent } from '../types/events';
import { useSupabaseEvents } from './useSupabaseEvents';
// Import your existing markdown events hook if you have one
// import { useMarkdownEvents } from './useMarkdownEvents';

export function useEvents() {
  const { events: supabaseEvents, loading: supabaseLoading, error: supabaseError } = useSupabaseEvents();
  // const { events: markdownEvents, loading: markdownLoading } = useMarkdownEvents();

  const [allEvents, setAllEvents] = useState<ScheduleXEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // For now, just use Supabase events
    // In the future, you can combine:
    // setAllEvents([...markdownEvents, ...supabaseEvents]);

    setAllEvents(supabaseEvents);
    setLoading(supabaseLoading);
    setError(supabaseError);
  }, [supabaseEvents, supabaseLoading, supabaseError]);

  return {
    events: allEvents,
    loading,
    error,
  };
}
```

**💡 Learning Note - Composing Hooks:**

Hooks can call other hooks! This is called **hook composition**.

```typescript
function useEvents() {
  const hookA = useSupabaseEvents();  // ✅ Can call hooks
  const hookB = useMarkdownEvents();  // ✅ Can call multiple hooks

  // Combine the results
  return { events: [...hookA.events, ...hookB.events] };
}
```

**Rules of Hooks:**

1. ✅ Only call at top level (not in loops/conditions)
2. ✅ Only call from React functions (components or custom hooks)
3. ✅ Custom hooks must start with `use`

### Step 4.2: Update Calendar to Use New Hook

Update `src/components/calendar.tsx`:

Replace the import and test events section:

**Before:**

```typescript
// Old test events
const testEvents: ScheduleXEvent[] = [
  // ... hardcoded events
];
```

**After:**

```typescript
import { useEvents } from '../hooks/useEvents';

export default function Calendar() {
  const { events, loading, error } = useEvents();  // Get events from database
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(null);

  // ... rest of component
```

Update the calendar initialization to use the fetched events:

```typescript
const calendar = useCalendarApp({
  views: [
    createViewDay(),
    createViewWeek(),
    createViewMonthGrid(),
    createViewMonthAgenda(),
  ],
  events: events,  // Use events from database instead of testEvents
  calendars: CALENDARS_CONFIG,
  plugins: [eventsService],
  selectedDate: "2026-01-30",  // Set to a date with your test events
  isDark: true,
  locale: 'en-US',
  firstDayOfWeek: 0,
  callbacks: {
    onEventClick(calendarEvent) {
      const fullEvent = events.find((e) => e.id === calendarEvent.id);
      if (fullEvent) {
        setSelectedEvent(fullEvent);
      }
    },
  },
});
```

Add loading and error states:

```typescript
export default function Calendar() {
  const { events, loading, error } = useEvents();
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(null);

  // Show loading state
  if (loading) {
    return (
      <div className="calendar-container">
        <h1>Boston Salsa Events Calendar</h1>
        <p style={{ textAlign: 'center' }}>Loading events...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="calendar-container">
        <h1>Boston Salsa Events Calendar</h1>
        <p style={{ textAlign: 'center', color: 'red' }}>
          Error loading events: {error}
        </p>
      </div>
    );
  }

  // Rest of calendar component...
```

### Step 4.3: Test the Calendar

1. Run `npm run dev`
2. Navigate to your calendar page
3. You should see your 3 test events from Supabase!
4. Click on an event - modal should open
5. Check network tab in DevTools - you should see a request to Supabase

### ✅ Day 4 Checkpoint

You should now have:

- [X] Unified `useEvents` hook combining data sources
- [X] Calendar displaying events from Supabase
- [X] Loading and error states implemented
- [X] Event modal working with database events

---

## Day 5: Add "Salsa Segura" Event Badges (2 hours)

Right now, all events look the same. Let's add special badges to YOUR events (the ones you create directly).

### Step 5.1: Add Source Field to Database

We need to track which events are yours vs community-submitted.

In Supabase SQL Editor, run:

```sql
-- Add source column to track event origin
alter table public.events
  add column source text default 'community' check (source in ('salsasegura', 'community'));

-- Update existing test events to be from Salsa Segura
update public.events
  set source = 'salsasegura';
```

### Step 5.2: Update TypeScript Types

Update `src/types/events.ts`:

```typescript
export interface DatabaseEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  event_date: string;
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: 'free' | 'paid' | null;
  price_amount: number | null;
  rsvp_link: string | null;
  image_url: string | null;
  status: 'approved' | 'pending' | 'rejected';
  source: 'salsasegura' | 'community';  // Add this line
  created_at: string;
}

export interface ScheduleXEvent {
  id: string | number;
  title: string;
  start: string;
  end: string;
  calendarId: EventType;
  location?: string;
  description?: string;
  address?: string;
  rsvpLink?: string;
  source?: 'salsasegura' | 'community';  // Add this line
}
```

Update the converter function:

```typescript
export function databaseEventToScheduleX(event: DatabaseEvent): ScheduleXEvent {
  const eventDate = new Date(event.event_date);
  const start = formatDateTimeForScheduleX(eventDate);
  const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
  const end = formatDateTimeForScheduleX(endDate);

  return {
    id: event.id,
    title: event.title,
    start,
    end,
    calendarId: event.event_type,
    location: event.location ?? undefined,
    description: event.description ?? undefined,
    address: event.address ?? undefined,
    rsvpLink: event.rsvp_link ?? undefined,
    source: event.source,  // Add this line
  };
}
```

### Step 5.3: Add Badge to Event Modal

Update `src/components/EventModal.tsx`:

Add the badge after the event type badge:

```typescript
<div className="modal-body">
  <span className={`event-type-badge ${event.calendarId}`}>
    {event.calendarId}
  </span>

  {/* Add this: Salsa Segura badge */}
  {event.source === 'salsasegura' && (
    <span className="salsa-segura-badge">
      ✨ Salsa Segura Event
    </span>
  )}

  {/* Rest of modal content... */}
```

Add CSS for the badge in your `Calendar.css` or `EventModal.css`:

```css
.salsa-segura-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #1a252f;
  margin-left: 0.5rem;
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3);
}

.dark-mode .salsa-segura-badge {
  background: linear-gradient(135deg, #ffd700, #ffb700);
}
```

### Step 5.4: Test the Badge

1. Click on one of your test events in the calendar
2. You should see both badges:
   - Event type badge (social/class/workshop)
   - "✨ Salsa Segura Event" badge

### ✅ Day 5 Checkpoint

You should now have:

- [X] `source` column added to database
- [X] Types updated to include source
- [X] Badge displaying on your events
- [X] Styled badge with gradient background

---

## Day 6: Deploy with Environment Variables (1 hour)

### Step 6.1: Update Build Command (Vite Specific)

Vite automatically includes environment variables starting with `VITE_` in the build. No changes needed to `package.json`!

### Step 6.2: Add Environment Variables to Azure

Your app is deployed on Azure. You need to add the Supabase credentials there.

**In Azure Portal:**

1. Go to your App Service (the one hosting salsasegura.com)
2. Click **"Configuration"** in the left sidebar
3. Under **"Application settings"**, click **"+ New application setting"**
4. Add both variables:

| Name                       | Value                     |
| -------------------------- | ------------------------- |
| `VITE_SUPABASE_URL`      | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key    |

5. Click **"Save"** at the top
6. Wait for the restart (this can take 1-2 minutes)

**💡 Learning Note - Environment Variables in Production:**

Different platforms have different ways to set environment variables:

| Platform          | How to Set                                           |
| ----------------- | ---------------------------------------------------- |
| **Azure**   | App Service → Configuration → Application settings |
| **Vercel**  | Project Settings → Environment Variables            |
| **Netlify** | Site Settings → Build & Deploy → Environment       |
| **Heroku**  | Settings → Config Vars                              |

### Step 6.3: Deploy Your Code

Commit all your changes:

```bash
git add .
git commit -m "Phase 3: Add Supabase database backend"
git push
```

Your Azure deployment should trigger automatically (if configured with CI/CD).

**If manual deployment:**

```bash
npm run build
# Then deploy the dist/ folder to Azure
```

### Step 6.4: Test Production Site

1. Visit your live site: www.salsasegura.com
2. Navigate to the calendar
3. Verify events load from Supabase
4. Click an event - modal should open
5. Check for "Salsa Segura Event" badge

**If events don't appear:**

1. Check Azure logs for errors
2. Verify environment variables are set correctly in Azure
3. Check browser console for errors
4. Verify Supabase RLS policies allow public read

### ✅ Day 6 Checkpoint

You should now have:

- [X] Environment variables configured in Azure
- [X] Code committed and pushed
- [X] Production site loading events from Supabase
- [X] All features working in production

---

## 🎉 Phase 3 Complete!

### What You Built

| Feature                       | Status    |
| ----------------------------- | --------- |
| Supabase account & project    | ✅        |
| PostgreSQL database schema    | ✅        |
| React connected to Supabase   | ✅        |
| Events fetched from database  | ✅        |
| Dual sources (markdown + DB)  | ✅        |
| "Salsa Segura" event badges   | ✅ Bonus! |
| Environment variables secured | ✅        |
| Deployed to production        | ✅        |

### What You Learned

1. **Backend as a Service (BaaS)** - Build full-stack without managing servers
2. **PostgreSQL fundamentals** - Tables, columns, data types, constraints
3. **SQL queries** - SELECT, INSERT, WHERE, ORDER BY
4. **Supabase JavaScript client** - Query builder API
5. **Async JavaScript** - Promises, async/await, useEffect
6. **Environment variables** - Secure API keys, per-environment config
7. **Data modeling** - Designing scalable database schemas
8. **Row Level Security** - Database-level access control
9. **Type safety** - TypeScript interfaces for database models
10. **Hook composition** - Combining multiple React hooks

### Git Commit

If you haven't already:

```bash
git add .
git commit -m "Phase 3: Complete Supabase backend integration"
git tag -a v0.3 -m "Phase 3: Database backend"
git push
git push --tags
```

---

## 🔍 Troubleshooting

### "Missing Supabase environment variables"

**Problem:** Error on startup
**Solution:**

1. Verify `.env.local` exists in project root
2. Check variable names match exactly: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Restart dev server after creating `.env.local`

### "Failed to load events" / Network errors

**Problem:** Can't fetch from Supabase
**Solution:**

1. Check Supabase project is running (not paused)
2. Verify API keys are correct
3. Check browser Network tab for actual error
4. Test query directly in Supabase SQL Editor

### Events not showing in production

**Problem:** Works locally but not on Azure
**Solution:**

1. Verify environment variables are set in Azure Configuration
2. Check Azure deployment logs for errors
3. Ensure build completed successfully
4. Hard refresh browser (Ctrl+Shift+R) to clear cache

### "Row Level Security" blocking queries

**Problem:** Queries return empty even though data exists
**Solution:**

1. Check RLS policies in Supabase dashboard
2. Ensure "Public events are viewable" policy exists
3. Test query in SQL Editor with RLS disabled
4. Verify events have `status = 'approved'`

---

## 📖 Further Reading

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)
- [SQL vs NoSQL Databases](https://www.mongodb.com/nosql-explained/nosql-vs-sql)
- [Async/Await Explained](https://javascript.info/async-await)
- [Environment Variables Best Practices](https://12factor.net/config)

---

## ➡️ Next Phase Preview

**Phase 4: Event Submission Form**

- Build multi-step form with React Hook Form
- Handle form validation
- Upload images to Supabase Storage
- Submit events to database (status: 'pending')
- Success/error feedback to users

You'll learn:

- Advanced form handling in React
- File uploads
- Multi-step user flows
- Form validation patterns
- User experience design

---

**🎊 Congratulations! You now have a database-powered event calendar!**

The events you see on your calendar are coming from a real PostgreSQL database, queried through Supabase's APIs, and displayed dynamically in your React app. This is the foundation for all future features - user submissions, authentication, moderation, and more!
