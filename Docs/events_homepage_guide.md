# Events → Homepage Guide

This guide shows how to load events (markdown + Supabase), merge them, fix the `Events` component hook usage, and render events on the homepage.

## Overview

- Goal: Display upcoming events on the homepage combining markdown files in `content/events` and events stored in Supabase.
- Files touched or created:
  - `src/lib/supabase.ts` — Supabase client
  - `src/hooks/useSupabaseEvents.ts` — fetch DB events
  - `src/hooks/useMarkdownEvents.ts` — existing
  - `src/hooks/useEvent.ts` — combine sources (existing)
  - `src/components/Events/Events.tsx` — move hook call inside component
  - `src/pages/HomePage.tsx` — render `Events`

---

## Prerequisites

- Node environment and project dependencies installed.
- `.env.local` created with Vite-style vars:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- `@supabase/supabase-js` installed:

```bash
npm install @supabase/supabase-js
```

- Ensure `.env.local` is listed in `.gitignore`.

---

## 1) Supabase client (`src/lib/supabase.ts`)

Create (or verify) the client file:

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
```

Why: keeps one shared client instance and fails early if env vars are missing.

---

## 2) Hooks architecture

Recommended hooks and responsibilities:

- `useMarkdownEvents.ts` — reads markdown files in `content/events` using `import.meta.glob` and returns a typed array of events.
- `useSupabaseEvents.ts` — queries the `events` table in Supabase, maps DB rows into the same event shape used by the UI.
- `useEvent.ts` — composes the two sources, deduplicates, sorts by date, and exposes `{ events, loading, error }`.

Example merging logic (in `src/hooks/useEvent.ts`):

```ts
import { useMemo } from 'react';
import useMarkdownEvents from './useMarkdownEvents';
import { useSupabaseEvents } from './useSupabaseEvents';

export default function useEvents() {
  const { events: mdEvents, loading: mdLoading } = useMarkdownEvents();
  const { events: dbEvents, loading: dbLoading, error } = useSupabaseEvents();

  const events = useMemo(() => {
    const combined = [...mdEvents, ...dbEvents];
    const unique = Array.from(
      new Map(combined.map(e => [e.id ?? `${e.title}-${e.date}`, e])).values()
    );
    return unique.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [mdEvents, dbEvents]);

  return { events, loading: mdLoading || dbLoading, error };
}
```

Notes:
- Dedupe by `id` (or title+date if markdown files use no id).
- Keep the UI event shape consistent between markdown and DB.

---

## 3) Fix `Events` component hook placement

Problem: calling hooks at module top-level causes React hook rules violations and prevents proper behavior. Move the `useEvents()` call inside the `Events` component function.

Open `src/components/Events/Events.tsx` and do the following change:

- Remove or replace any top-level call like:

```ts
// BAD — at top-level
const { events, loading, error } = useEvents();
```

- Inside the component function, add it at the top:

```tsx
function Events() {
  const { events: upcomingEvents, loading, error } = useEvents();

  // existing UI code uses upcomingEvents now
}
```

If the component also uses `import.meta.glob` to load markdown directly, prefer centralizing that in `useMarkdownEvents` and letting `useEvents` return the final array.

---

## 4) Rendering `Events` on the homepage

In `src/pages/HomePage.tsx`, import and include the component:

```tsx
import Events from '../components/Events/Events';

export default function HomePage() {
  return (
    <MainLayout>
      {/* other sections */}
      <Events />
    </MainLayout>
  );
}
```

Adjust the import path if your project layout differs.

---

## 5) Markdown frontmatter and parsing

Each file in `content/events` should include YAML frontmatter with at least:

```yaml
---
title: "Salsa Pop-up"
date: "2026-02-15T19:00:00-05:00"
type: "social"
time: "7:00 PM"
location: "Community Center"
address: "123 Main St, Boston, MA"
rsvpLink: "https://example.com/rsvp"
---

Event description in markdown...
```

Parsing notes:
- Use `front-matter` (or `gray-matter`) to parse attributes and body.
- Convert body to HTML using `marked` or `remark`.
- Sanitize HTML if users can edit content (e.g., use `DOMPurify`) before `dangerouslySetInnerHTML`.

---

## 6) Supabase query example (`useSupabaseEvents.ts`)

A minimal fetcher:

```ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useSupabaseEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    supabase
      .from('events')
      .select('*')
      .eq('status', 'approved')
      .order('event_date', { ascending: true })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) return setError(error);
        const normalized = (data || []).map(row => ({
          id: row.id,
          title: row.title,
          date: row.event_date,
          time: row.event_time ?? '',
          location: row.location ?? '',
          address: row.address ?? '',
          description: row.description ?? '',
          rsvpLink: row.rsvp_link ?? '',
          type: row.event_type ?? 'social',
        }));
        setEvents(normalized);
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false };
  }, []);

  return { events, loading, error };
}
```

---

## 7) Running & testing

Start the dev server:

```bash
npm install
npm run dev
```

If you see the error `Missing VITE_SUPABASE_*`, verify `.env.local` has correct keys and restart the dev server.

Testing tips:
- Add `console.log` inside `useEvent` to inspect merged array.
- Temporarily render `JSON.stringify(events)` above the events grid to verify shape.

---

## 8) Troubleshooting

- No events shown:
  - Are markdown files present and valid YAML date? (ISO string)
  - Does Supabase table contain rows with `status = 'approved'`?
  - Are env vars loaded? `import.meta.env.VITE_SUPABASE_URL`

- `Rendered more hooks than during the previous render`:
  - Ensure hooks are only called at top-level of components and not inside conditional branches.

- Sanitization:
  - If event body is user-provided, sanitize HTML before using `dangerouslySetInnerHTML`.

---

## 9) Next steps (optional)

- Add caching and revalidation for Supabase queries.
- Add admin UI to create events via Supabase.
- Add images in Supabase Storage and display in the event card.

---

If you want, I can now:
- Apply the `Events.tsx` fix automatically and run the dev server to validate.
- Create or update the hooks (`useEvent.ts`, `useSupabaseEvents.ts`) in `src/hooks/`.

Tell me which of those you'd like me to do next.
