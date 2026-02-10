# Events → Homepage Guide

This guide shows how to load events from Supabase, display them in the `Events` component and Schedule-X calendar, and render events on the homepage.

**Each section shows the COMPLETE file contents** — copy the entire code block into the specified file.

---

## Table of Contents

1. [Overview & Architecture](#overview)
2. [File Structure](#file-structure)
3. [Prerequisites](#prerequisites)
4. [File 1: Environment Variables](#file-1-environment-variables-envlocal)
5. [File 2: Supabase Client](#file-2-supabase-client)
6. [File 3: Event Types & Converter](#file-3-event-types--converter)
7. [File 4: useSupabaseEvents Hook](#file-4-usesupabaseevents-hook)
8. [File 5: useEvents Wrapper Hook](#file-5-useevents-wrapper-hook)
9. [File 6: Events Component](#file-6-events-component)
10. [File 7: HomePage](#file-7-homepage)
11. [Running & Testing](#running--testing)
12. [Troubleshooting](#troubleshooting)
13. [Quick Reference Checklist](#quick-reference-checklist)
14. [Glossary](#glossary)

---

## Overview

**Goal:** Fetch events from Supabase database and display them on the homepage using the `ScheduleXEvent` format (compatible with both the Events component and Schedule-X calendar).

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE DATABASE                         │
│                    events table (DatabaseEvent)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              src/hooks/useSupabaseEvents.ts                      │
│  • Fetches events from Supabase                                  │
│  • Converts DatabaseEvent[] → ScheduleXEvent[]                   │
│  • Returns { events, loading, error }                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                src/hooks/useEvent.ts                             │
│  • Wrapper hook (for future filtering/caching)                   │
│  • Returns { events, loading, error }                            │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  Events.tsx (Homepage)   │    │  Calendar.tsx (Calendar) │
│  • Shows event cards     │    │  • Schedule-X calendar   │
│  • Uses ScheduleXEvent   │    │  • Uses ScheduleXEvent   │
└──────────────────────────┘    └──────────────────────────┘
```

---

## File Structure

After completing this guide, you'll have these files:

```
src/
├── lib/
│   └── supabase.ts           ← File 2: Supabase client
├── types/
│   └── events.ts             ← File 3: Interfaces & converter
├── hooks/
│   ├── useSupabaseEvents.ts  ← File 4: Fetch from database
│   └── useEvent.ts           ← File 5: Wrapper hook
├── components/
│   └── Events/
│       ├── Events.tsx        ← File 6: Display events
│       └── Events.css        ← (styling, not covered here)
└── pages/
    └── HomePage.tsx          ← File 7: Renders Events
```

---

## Prerequisites

Before starting, ensure you have:

- [ ] Bun installed (`bun --version`)
- [ ] Supabase project created with an `events` table
- [ ] `@supabase/supabase-js` installed: `bun add @supabase/supabase-js`

---

## File 1: Environment Variables (`.env.local`)

**Location:** Project root (same folder as `package.json`)

**Create this file:** `.env.local`

```bash
# Supabase Configuration
# Get these values from: Supabase Dashboard → Settings → API

VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-key-here
```

**⚠️ Important:**

1. Replace the placeholder values with YOUR actual Supabase credentials
2. Add `.env.local` to your `.gitignore` file
3. Restart the dev server after creating/changing this file

> 💡 **Learning Note — Environment Variables**
>
> Environment variables store configuration **outside your code** for security and flexibility.
>
> **Why use them?**
>
> - ✅ Keep secrets (API keys, passwords) out of git history
> - ✅ Different values per environment (dev, staging, production)
> - ✅ Easy to change without editing code
>
> **Vite prefix requirement:**
> Vite only exposes variables starting with `VITE_` to the frontend. This prevents accidentally leaking backend-only secrets like `DATABASE_PASSWORD`.
>
> ```typescript
> // ✅ Accessible in browser (has VITE_ prefix)
> import.meta.env.VITE_SUPABASE_URL;
>
> // ❌ NOT accessible in browser (no prefix)
> import.meta.env.DATABASE_PASSWORD; // undefined!
> ```

> 💡 **Where to find your Supabase credentials:**
>
> 1. Go to [supabase.com](https://supabase.com) and open your project
> 2. Click **Settings** (gear icon) in the left sidebar
> 3. Click **API** under "Project Settings"
> 4. Copy **Project URL** → paste as `VITE_SUPABASE_URL`
> 5. Copy **anon public** key → paste as `VITE_SUPABASE_ANON_KEY`

---

## File 2: Supabase Client

**Location:** `src/lib/supabase.ts`

**Create folders if needed:**

```bash
mkdir -p src/lib
```

**Complete file contents:**

```typescript
// src/lib/supabase.ts
// Purpose: Create a single Supabase client instance for the entire app

import { createClient } from "@supabase/supabase-js";

// Read environment variables (set in .env.local)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail early if env vars are missing (helps catch configuration errors)
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables!\n" +
      "Make sure .env.local exists with:\n" +
      "  VITE_SUPABASE_URL=your-url\n" +
      "  VITE_SUPABASE_ANON_KEY=your-key\n" +
      "Then restart the dev server.",
  );
}

// Create and export the Supabase client (singleton pattern)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Also export as default for flexibility
export default supabase;
```

> 💡 **Learning Note — ES6 Modules (import/export)**
>
> JavaScript modules let you split code across files:
>
> ```typescript
> // Named export (can have multiple per file)
> export const supabase = createClient(...);
> export const anotherThing = ...;
>
> // Default export (one per file)
> export default supabase;
>
> // Importing:
> import { supabase } from "./supabase";      // Named import
> import supabase from "./supabase";          // Default import
> import supabase, { other } from "./supabase"; // Both
> ```
>
> **When to use which?**
>
> - **Named exports**: Multiple related things (types, functions)
> - **Default exports**: One main thing per file (components)

> 💡 **Learning Note — Template Literals**
>
> The backtick strings (`` ` ``) allow embedded expressions:
>
> ```typescript
> // Old way (concatenation)
> "Missing " +
>   varName +
>   " in config"
>   // Template literal (cleaner!)
>   `Missing ${varName} in config`;
>
> // Multi-line strings
> const message = `
>   Line 1
>   Line 2
> `;
> ```

> 💡 **Learning Note — Singleton Pattern**
>
> We create ONE client and export it. Every file that imports `supabase` gets the SAME instance. This is efficient because:
>
> - Reuses the same network connection
> - Consistent state across your app
> - Better memory usage

---

## File 3: Event Types & Converter

**Location:** `src/types/events.ts`

**Create folders if needed:**

```bash
mkdir -p src/types
```

**Complete file contents:**

```typescript
// src/types/events.ts
// Purpose: Define event interfaces and conversion functions

import "temporal-polyfill/global";

// ============================================
// TYPE DEFINITIONS
// ============================================

// Event categories used for color-coding in the calendar
export type EventType = "social" | "class" | "workshop";

// 💡 This is a "Union Type" - EventType can ONLY be one of these 3 strings
// TypeScript will error if you try: const x: EventType = "party" ❌

// DatabaseEvent: Matches the Supabase 'events' table schema exactly
// This is what comes FROM the database
export interface DatabaseEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  event_date: string; // ISO timestamp: "2026-02-15T19:00:00+00:00"
  event_time: string | null; // Display time: "7:00 PM"
  location: string | null; // Venue name: "CRG Studio"
  address: string | null; // Full address: "123 Main St, Boston"
  price_type: "free" | "Paid" | null;
  price_amount: number | null;
  rsvp_link: string | null;
  image_url: string | null;
  status: "approved" | "pending" | "rejected";
  created_at: string;
}

// ScheduleXEvent: The format Schedule-X calendar expects
// This is what we use in the UI (both Events.tsx and Calendar.tsx)
export interface ScheduleXEvent {
  id: string | number;
  title: string;
  start: string; // "YYYY-MM-DD HH:mm" format
  end: string; // "YYYY-MM-DD HH:mm" format
  calendarId: EventType; // Used for color-coding
  location?: string;
  description?: string;
  // Custom properties for our app (Schedule-X ignores these but we use them)
  address?: string;
  rsvpLink?: string;
}

// ============================================
// CALENDAR COLOR CONFIGURATION
// ============================================

// Colors for each event type (used by Schedule-X calendar)
export const CALENDARS_CONFIG = {
  social: {
    colorName: "social",
    lightColors: {
      main: "#ff8c42", // Orange
      container: "#ffe4d1",
      onContainer: "#5c2e00",
    },
    darkColors: {
      main: "#ffb380",
      container: "#8b4513",
      onContainer: "#ffe4d1",
    },
  },
  class: {
    colorName: "class",
    lightColors: {
      main: "#3498db", // Blue
      container: "#d6eaf8",
      onContainer: "#1a4a6e",
    },
    darkColors: {
      main: "#85c1e9",
      container: "#2471a3",
      onContainer: "#d6eaf8",
    },
  },
  workshop: {
    colorName: "workshop",
    lightColors: {
      main: "#27ae60", // Green
      container: "#d5f5e3",
      onContainer: "#145a32",
    },
    darkColors: {
      main: "#82e0aa",
      container: "#1e8449",
      onContainer: "#d5f5e3",
    },
  },
};

// ============================================
// CONVERTER FUNCTIONS
// ============================================

/**
 * Convert a DatabaseEvent (from Supabase) to ScheduleXEvent (for UI)
 *
 * Why we need this:
 * - Database uses 'event_date' (ISO timestamp), Schedule-X needs 'start'/'end'
 * - Database uses 'rsvp_link' (snake_case), UI uses 'rsvpLink' (camelCase)
 * - Database has null values, UI prefers undefined for optional fields
 */
export function databaseEventToScheduleX(event: DatabaseEvent): ScheduleXEvent {
  // Parse the ISO timestamp from the database
  const eventDate = new Date(event.event_date);

  // Format start time as "YYYY-MM-DD HH:mm" (what Schedule-X expects)
  const start = formatDateTimeForScheduleX(eventDate);

  // Calculate end time (assume 2 hours if not specified)
  const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
  const end = formatDateTimeForScheduleX(endDate);

  // Return the converted event
  // Note: ?? undefined converts null to undefined (TypeScript prefers this)
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

/**
 * Format a Date object to "YYYY-MM-DD HH:mm" string
 * This is the format Schedule-X requires for start/end times
 */
function formatDateTimeForScheduleX(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// ============================================
// HELPER FUNCTIONS (for manual event creation)
// ============================================

/**
 * Helper to create a ZonedDateTime for Boston timezone
 * Useful when manually creating events in code
 */
export function bostonDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number = 0,
): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.from({
    year,
    month,
    day,
    hour,
    minute,
    second: 0,
    timeZone: "America/New_York",
  });
}
```

> 💡 **Learning Note — Why Two Interfaces?**
>
> | DatabaseEvent             | ScheduleXEvent              |
> | ------------------------- | --------------------------- |
> | `event_date` (ISO string) | `start` / `end` (formatted) |
> | `rsvp_link` (snake_case)  | `rsvpLink` (camelCase)      |
> | `null` for empty fields   | `undefined` for optional    |
> | Matches database schema   | Matches UI requirements     |

> 💡 **TypeScript Learning Note — Interface vs Type**
>
> Both define object shapes, but have subtle differences:
>
> ```typescript
> // Interface (preferred for objects)
> interface DatabaseEvent {
>   id: string;
>   title: string;
> }
>
> // Type alias (preferred for unions, primitives)
> type EventType = "social" | "class" | "workshop";
> type StringOrNumber = string | number;
> ```
>
> **Key differences:**
> | Feature | `interface` | `type` |
> |---------|-------------|--------|
> | Extend/merge | ✅ Can be extended | ❌ Cannot reopen |
> | Union types | ❌ No | ✅ Yes |
> | Objects | ✅ Best for | ✅ Works |
> | Error messages | Clearer | More complex |
>
> **Rule of thumb:** Use `interface` for objects, `type` for everything else.

> 💡 **TypeScript Learning Note — Optional Properties (`?`)**
>
> The `?` makes a property optional:
>
> ```typescript
> interface ScheduleXEvent {
>   id: string; // Required - must have
>   title: string; // Required - must have
>   location?: string; // Optional - can be missing
>   description?: string; // Optional - can be missing
> }
>
> // ✅ Valid (optional fields omitted)
> const event: ScheduleXEvent = { id: "1", title: "Party" };
>
> // ✅ Valid (optional fields included)
> const event2: ScheduleXEvent = {
>   id: "1",
>   title: "Party",
>   location: "Boston",
> };
>
> // ❌ Invalid (missing required field)
> const bad: ScheduleXEvent = { id: "1" }; // Error: missing 'title'
> ```

> 💡 **JavaScript Learning Note — Nullish Coalescing (`??`)**
>
> The `??` operator returns the right side ONLY if the left is `null` or `undefined`:
>
> ```typescript
> // Database returns null for empty fields
> event.location; // null
>
> // ?? converts null/undefined to a default value
> event.location ?? undefined; // undefined
> event.location ?? "Unknown"; // "Unknown"
>
> // Comparison with || (or):
> "" || "default"; // "default" (empty string is falsy!)
> "" ?? "default"; // "" (empty string is NOT nullish)
>
> 0 || "default"; // "default" (0 is falsy!)
> 0 ?? "default"; // 0 (0 is NOT nullish)
> ```
>
> **Use `??` when** `0`, `""`, or `false` are valid values you want to keep.

---

## File 4: useSupabaseEvents Hook

**Location:** `src/hooks/useSupabaseEvents.ts`

**Create folders if needed:**

```bash
mkdir -p src/hooks
```

**Complete file contents:**

```typescript
// src/hooks/useSupabaseEvents.ts
// Purpose: Fetch events from Supabase and convert to ScheduleXEvent format

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  DatabaseEvent,
  ScheduleXEvent,
  databaseEventToScheduleX,
} from "../types/events";

/**
 * Custom hook to fetch events from Supabase
 *
 * Returns:
 * - events: ScheduleXEvent[] - Array of events in UI-ready format
 * - loading: boolean - True while fetching data
 * - error: string | null - Error message if fetch failed
 *
 * Usage:
 *   const { events, loading, error } = useSupabaseEvents();
 */
export function useSupabaseEvents() {
  // State for the events array (starts empty)
  const [events, setEvents] = useState<ScheduleXEvent[]>([]);

  // State for loading indicator (starts true because we fetch on mount)
  const [loading, setLoading] = useState(true);

  // State for error message (starts null = no error)
  const [error, setError] = useState<string | null>(null);

  // 💡 useState<Type>(initialValue) - the <Type> tells TypeScript what type the state holds
  // 💡 useState returns [currentValue, setterFunction] - we destructure both

  // useEffect runs when component mounts (empty dependency array [])
  useEffect(() => {
    // Track if component is still mounted (prevents state updates after unmount)
    let mounted = true;

    // Define async function to fetch events
    async function fetchEvents() {
      try {
        setLoading(true);
        setError(null);

        // Query Supabase for approved events, ordered by date
        const { data, error: supabaseError } = await supabase
          .from("events") // FROM events table
          .select("*") // SELECT all columns
          .eq("status", "approved") // WHERE status = 'approved'
          .order("event_date", { ascending: true }); // ORDER BY event_date ASC

        // If component unmounted while fetching, don't update state
        if (!mounted) return;

        // Handle Supabase error
        if (supabaseError) {
          console.error("Supabase error:", supabaseError);
          setError(supabaseError.message);
          return;
        }

        // Convert database events to Schedule-X format
        // data is DatabaseEvent[], we convert each to ScheduleXEvent
        const converted: ScheduleXEvent[] = (
          (data as DatabaseEvent[]) || []
        ).map(databaseEventToScheduleX);

        // Update state with converted events
        setEvents(converted);
      } catch (err) {
        // Handle unexpected errors
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Fetch error:", err);
        setError(message);
      } finally {
        // Always set loading to false when done (success or error)
        if (mounted) {
          setLoading(false);
        }
      }
    }

    // Call the fetch function
    fetchEvents();

    // Cleanup function: runs when component unmounts
    return () => {
      mounted = false;
    };
  }, []); // Empty array = only run once on mount

  // Return the state values for components to use
  return { events, loading, error };
}
```

> 💡 **React Learning Note — useState Hook**
>
> `useState` is React's way to add "memory" to a component:
>
> ```typescript
> const [value, setValue] = useState<Type>(initialValue);
> //     │       │                  │      └── Starting value
> //     │       │                  └── TypeScript type (optional)
> //     │       └── Function to UPDATE the value
> //     └── Current value (read-only)
> ```
>
> **Examples:**
>
> ```typescript
> const [count, setCount] = useState(0); // number
> const [name, setName] = useState(""); // string
> const [items, setItems] = useState<Item[]>([]); // array with type
> const [user, setUser] = useState<User | null>(null); // nullable
> ```
>
> **Updating state:**
>
> ```typescript
> setCount(5); // Set to specific value
> setCount((prev) => prev + 1); // Update based on previous
> setItems((prev) => [...prev, newItem]); // Add to array
> ```
>
> **Key rule:** Never mutate state directly! Always use the setter.
>
> ```typescript
> // ❌ WRONG
> items.push(newItem);
>
> // ✅ CORRECT
> setItems([...items, newItem]);
> ```

> 💡 **React Learning Note — useEffect Hook**
>
> `useEffect` runs code **after** the component renders:
>
> ```typescript
> useEffect(() => {
>   // This code runs after render
>   console.log("Component rendered!");
>
>   return () => {
>     // Cleanup: runs before next effect or unmount
>     console.log("Cleaning up!");
>   };
> }, [dependencies]); // When to re-run
> ```
>
> **Dependency array controls when effect runs:**
>
> ```typescript
> useEffect(() => {...}, []);      // [] = only on mount (once)
> useEffect(() => {...}, [id]);    // [id] = when 'id' changes
> useEffect(() => {...});          // no array = every render (rare!)
> ```
>
> **Common uses:**
>
> - Fetching data (like our Supabase query)
> - Setting up subscriptions
> - Updating the document title

> 💡 **JavaScript Learning Note — async/await**
>
> `async/await` makes asynchronous code look synchronous:
>
> ```typescript
> // Without async/await (callback hell)
> fetch(url)
>   .then((response) => response.json())
>   .then((data) => console.log(data))
>   .catch((error) => console.error(error));
>
> // With async/await (cleaner!)
> async function fetchData() {
>   try {
>     const response = await fetch(url);
>     const data = await response.json();
>     console.log(data);
>   } catch (error) {
>     console.error(error);
>   }
> }
> ```
>
> **Key points:**
>
> - `async` before function = it returns a Promise
> - `await` pauses until the Promise resolves
> - Use `try/catch` for error handling
> - Can only use `await` inside `async` functions

> 💡 **JavaScript Learning Note — Destructuring**
>
> Destructuring extracts values from objects/arrays:
>
> ```typescript
> // Object destructuring
> const { data, error } = await supabase.from("events").select();
> //     │      │
> //     │      └── Same as: const error = result.error;
> //     └── Same as: const data = result.data;
>
> // Array destructuring (useState uses this!)
> const [first, second] = ["a", "b"];
> // first = "a", second = "b"
>
> // With rename
> const { data: events } = result; // events = result.data
>
> // With defaults
> const { data = [] } = result; // data = result.data or []
> ```

> 💡 **Learning Note — The `mounted` Flag Pattern**
>
> ```typescript
> let mounted = true;
> // ... async code ...
> if (!mounted) return; // Don't update state if unmounted
> return () => {
>   mounted = false;
> }; // Cleanup on unmount
> ```
>
> This prevents the React warning "Can't perform state update on unmounted component" when:
>
> - User navigates away before data loads
> - Component is removed while fetch is in progress

---

## File 5: useEvents Wrapper Hook

**Location:** `src/hooks/useEvent.ts`

**Complete file contents:**

```typescript
// src/hooks/useEvent.ts
// Purpose: Wrapper hook for event data (allows future enhancements)

import { useSupabaseEvents } from "./useSupabaseEvents";

/**
 * Wrapper hook for event data
 *
 * Currently just passes through useSupabaseEvents, but provides
 * a stable API for components. Future enhancements:
 * - Add filtering by date range
 * - Add caching with localStorage
 * - Combine multiple data sources
 * - Add real-time updates
 *
 * Usage:
 *   const { events, loading, error } = useEvents();
 */
export function useEvents() {
  // Get events from Supabase
  const { events, loading, error } = useSupabaseEvents();

  // Future: Add processing here
  // const filteredEvents = events.filter(e => new Date(e.start) > new Date());
  // const sortedEvents = [...events].sort((a, b) => a.start.localeCompare(b.start));

  // Return the same interface (components don't need to change)
  return {
    events,
    loading,
    error,
  };
}
```

> 💡 **Learning Note — Why a Wrapper Hook?**
>
> Your components always call `useEvents()`. If you later want to:
>
> - Add caching → change useEvents, not every component
> - Add real-time updates → change useEvents, not every component
> - Combine multiple sources → change useEvents, not every component
>
> This is the **Facade Pattern** — hide complexity behind a simple interface.

---

## File 6: Events Component

**Location:** `src/components/Events/Events.tsx`

**Complete file contents:**

```tsx
// src/components/Events/Events.tsx
// Purpose: Display event cards on the homepage

import { useEvents } from "../../hooks/useEvent";
import { ScheduleXEvent } from "../../types/events";
import "./Events.css";

/**
 * Events component - displays a grid of upcoming event cards
 *
 * Uses the useEvents hook to fetch data from Supabase.
 * Shows loading state, error state, and empty state appropriately.
 */
function Events() {
  // ⚠️ IMPORTANT: Hooks must be called at the TOP of the component function
  // Never put hooks inside conditions, loops, or nested functions!
  const { events, loading, error } = useEvents();

  // Loading state: show while fetching data
  if (loading) {
    return (
      <section id="events" className="events">
        <div className="container">
          <h2 className="section-title">Upcoming Events</h2>
          <p className="loading-message">Loading events...</p>
        </div>
      </section>
    );
  }

  // Error state: show if fetch failed
  if (error) {
    return (
      <section id="events" className="events">
        <div className="container">
          <h2 className="section-title">Upcoming Events</h2>
          <div className="error-message">
            <p>Failed to load events: {error}</p>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        </div>
      </section>
    );
  }

  // Main render: show event cards
  return (
    <section id="events" className="events">
      <div className="container">
        <h2 className="section-title">Upcoming Events</h2>
        <p className="events-intro">
          Join us for pop-up salsa classes and social dance events around
          Boston!
        </p>

        {/* Event cards grid */}
        {/* 💡 .map() transforms each event into a React element */}
        {/* 💡 key={event.id} helps React track which items changed */}
        <div className="events-grid">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>

        {/* Empty state: no events found */}
        {events.length === 0 && (
          <div className="no-events">
            <p>
              No upcoming events scheduled. Check back soon or follow us on
              Instagram for updates!
            </p>
          </div>
        )}

        {/* Call to action */}
        <div className="events-cta">
          <p>Want to host a pop-up class or private event?</p>
          <a href="#contact" className="cta-button">
            Contact Us
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * EventCard component - displays a single event
 *
 * Receives a ScheduleXEvent and renders it as a card.
 */
function EventCard({ event }: { event: ScheduleXEvent }) {
  // Parse the start date for display
  const startDate = new Date(event.start.replace(" ", "T"));
  const month = startDate
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  const day = startDate.getDate().toString();
  const time = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="event-card">
      {/* Date badge */}
      <div className="event-date">
        <span className="event-month">{month}</span>
        <span className="event-day">{day}</span>
      </div>

      {/* Event details */}
      <div className="event-details">
        {/* Event type badge */}
        <span className={`event-type ${event.calendarId}`}>
          {event.calendarId}
        </span>

        {/* Title */}
        <h3>{event.title}</h3>

        {/* Location */}
        {event.location && (
          <p className="event-location">🏙️ {event.location}</p>
        )}

        {/* Time */}
        <p className="event-time">🕐 {time}</p>

        {/* Address with Google Maps link */}
        {event.address && (
          <p className="event-address">
            📍{" "}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                event.address,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="event-address-link"
            >
              {event.address}
            </a>
          </p>
        )}

        {/* Description */}
        {event.description && (
          <p className="event-description">{event.description}</p>
        )}

        {/* RSVP Button */}
        {event.rsvpLink && (
          <a
            href={event.rsvpLink}
            className="rsvp-button"
            target="_blank"
            rel="noopener noreferrer"
          >
            RSVP Now
          </a>
        )}
      </div>
    </div>
  );
}

export default Events;
```

> 💡 **React Learning Note — Rules of Hooks**
>
> React has strict rules about where you can call hooks:
>
> ```tsx
> // ✅ CORRECT: Hook at top of component
> function Events() {
>   const { events } = useEvents(); // Always called, same order
>   // ...
> }
>
> // ❌ WRONG: Hook inside condition
> function Events() {
>   if (someCondition) {
>     const { events } = useEvents(); // Might not be called!
>   }
> }
> ```
>
> **The Rules:**
>
> 1. Only call hooks at the **top level** (not in loops, conditions, or nested functions)
> 2. Only call hooks from **React functions** (components or custom hooks)
>
> **Why?** React tracks hooks by the **order** they're called. If hooks are inside conditions, the order might change between renders.

> 💡 **React Learning Note — Rendering Lists with .map()**
>
> To display an array in React, use `.map()` to transform data into JSX:
>
> ```tsx
> function EventsList({ events }) {
>   return (
>     <ul>
>       {events.map((event) => (
>         <li key={event.id}>
>           {" "}
>           {/* key is REQUIRED! */}
>           <h3>{event.title}</h3>
>           <p>{event.location}</p>
>         </li>
>       ))}
>     </ul>
>   );
> }
> ```
>
> **Why `key={event.id}`?**
>
> - React needs to track which items changed, were added, or removed
> - Keys help React update efficiently (only changed items re-render)
>
> **Good keys vs bad keys:**
>
> ```tsx
> // ✅ Good: unique ID from database
> key={event.id}
>
> // ⚠️ OK: unique string (if no ID)
> key={event.title + event.date}
>
> // ❌ Bad: array index (breaks with reordering)
> key={index}
>
> // ❌ Bad: random (changes every render!)
> key={Math.random()}
> ```

> 💡 **React Learning Note — Conditional Rendering**
>
> Several ways to show/hide elements:
>
> ```tsx
> // 1. && operator (show if true)
> {
>   event.location && <p>{event.location}</p>;
> }
>
> // 2. Ternary (show one or the other)
> {
>   loading ? <Spinner /> : <Content />;
> }
>
> // 3. Early return (in component body)
> if (loading) return <Spinner />;
> if (error) return <Error />;
> return <Content />;
>
> // 4. Variable assignment
> let content;
> if (loading) content = <Spinner />;
> else content = <Data />;
> return <div>{content}</div>;
> ```
>
> **Common pattern for optional fields:**
>
> ```tsx
> {
>   /* Only renders if event.location is truthy */
> }
> {
>   event.location && <p className="location">📍 {event.location}</p>;
> }
> ```

> 💡 **React Learning Note — Props (Component Properties)**
>
> Props pass data from parent to child components:
>
> ```tsx
> // Parent passes props
> <EventCard event={myEvent} showRsvp={true} />;
>
> // Child receives props (object destructuring)
> function EventCard({ event, showRsvp }: Props) {
>   return (
>     <div>
>       <h3>{event.title}</h3>
>       {showRsvp && <button>RSVP</button>}
>     </div>
>   );
> }
>
> // TypeScript: Define props type
> interface Props {
>   event: ScheduleXEvent;
>   showRsvp?: boolean; // Optional prop
> }
> ```
>
> **Props are read-only!** Never modify props directly.

---

## File 7: HomePage

**Location:** `src/pages/HomePage.tsx`

**Complete file contents:**

```tsx
// src/pages/HomePage.tsx
// Purpose: Main homepage that composes multiple sections

import Hero from "../components/Hero/Hero";
import Events from "../components/Events/Events";
import Contact from "../components/Contact/Contact";

/**
 * HomePage component - the main landing page
 *
 * Composes multiple components:
 * - Hero: Banner/intro section
 * - Events: Upcoming events grid (fetches from Supabase)
 * - Contact: Contact form
 */
function HomePage() {
  return (
    <>
      <Hero />
      <Events />
      <Contact />
    </>
  );
}

export default HomePage;
```

> 💡 **React Learning Note — Component Composition**
>
> ```
> HomePage
> ├── Hero          ← Banner/intro section
> ├── Events        ← Fetches its own data via useEvents()
> └── Contact       ← Contact form
> ```
>
> Each component is responsible for its own data. `HomePage` just arranges them — it doesn't need to know about Supabase or events.

> 💡 **React Learning Note — Fragments (`<>...</>`)**
>
> React components must return a **single element**. Fragments let you group elements without adding extra DOM nodes:
>
> ```tsx
> // ❌ Error: Adjacent JSX elements must be wrapped
> return (
>   <Hero />
>   <Events />
> );
>
> // ✅ Option 1: Fragment shorthand
> return (
>   <>
>     <Hero />
>     <Events />
>   </>
> );
>
> // ✅ Option 2: Explicit Fragment (needed for keys)
> return (
>   <React.Fragment>
>     <Hero />
>     <Events />
>   </React.Fragment>
> );
>
> // ✅ Option 3: Wrapper div (adds extra DOM node)
> return (
>   <div>
>     <Hero />
>     <Events />
>   </div>
> );
> ```
>
> **When to use which:**
>
> - `<>...</>` — Most cases, no extra markup needed
> - `<div>` — When you need to style the wrapper
> - `<React.Fragment key={...}>` — When mapping and need keys

> 💡 **React Learning Note — JSX Basics**
>
> JSX is JavaScript + HTML-like syntax:
>
> ```tsx
> // JSX looks like HTML but it's JavaScript!
> const element = <h1 className="title">Hello</h1>;
>
> // Compiles to:
> const element = React.createElement("h1", { className: "title" }, "Hello");
> ```
>
> **Key differences from HTML:**
> | HTML | JSX | Why |
> |------|-----|-----|
> | `class` | `className` | `class` is reserved in JS |
> | `for` | `htmlFor` | `for` is reserved in JS |
> | `onclick` | `onClick` | camelCase for events |
> | `style="..."` | `style={{...}}` | Object, not string |
>
> **Embedding JavaScript:**
>
> ```tsx
> const name = "World";
> return <h1>Hello, {name}!</h1>;  // Use {} for JS expressions
>
> // Any expression works inside {}
> <p>{2 + 2}</p>                    // 4
> <p>{user.name.toUpperCase()}</p>  // Method call
> <p>{isLoggedIn ? "Hi!" : "Login"}</p>  // Ternary
> ```

---

## Running & Testing

**Step 1: Install dependencies**

```bash
bun install
```

**Step 2: Verify .env.local exists**

```bash
cat .env.local
# Should show your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

**Step 3: Start the dev server**

```bash
bun run dev
```

**Step 4: Open browser**
Go to `http://localhost:5173` (or the port shown in terminal)

**Step 5: Verify events load**

- You should see your events from Supabase
- Check browser console (F12) for any errors
- Check Network tab to see the Supabase request

> ⚠️ **After changing `.env.local`, restart the dev server!**
> Vite reads env vars at startup, not during runtime.

---

## Troubleshooting

### No events showing

| Symptom                      | Likely Cause             | Fix                                    |
| ---------------------------- | ------------------------ | -------------------------------------- |
| Empty list, no error         | No approved events in DB | Add events with `status = 'approved'`  |
| Empty list, no error         | Events are in the past   | Set `event_date` to future dates       |
| Error: "Missing environment" | .env.local not found     | Create file with Supabase credentials  |
| Network error                | Wrong Supabase URL       | Copy URL from Supabase dashboard       |
| 401 Unauthorized             | Wrong API key            | Use the `anon` key, not `service_role` |

### Hook error: "Rendered more hooks"

This means hooks are being called conditionally. Fix: move ALL hook calls to the TOP of your component function, before any `if` statements or `return`.

### Changes not appearing

1. Did you save all files?
2. Did you restart dev server after changing `.env.local`?
3. Check browser console for errors
4. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

---

## Quick Reference Checklist

Use this to verify your setup:

- [ ] `.env.local` exists with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] `.env.local` is in `.gitignore`
- [ ] `@supabase/supabase-js` is installed
- [ ] `src/lib/supabase.ts` exists and exports `supabase` client
- [ ] `src/types/events.ts` has `DatabaseEvent`, `ScheduleXEvent`, and `databaseEventToScheduleX`
- [ ] `src/hooks/useSupabaseEvents.ts` fetches and converts events
- [ ] `src/hooks/useEvent.ts` wraps useSupabaseEvents
- [ ] `src/components/Events/Events.tsx` calls `useEvents()` at top of function
- [ ] `src/pages/HomePage.tsx` renders `<Events />`
- [ ] Supabase has events with `status = 'approved'` and future `event_date`
- [ ] `bun run dev` shows events with no console errors

---

## Glossary

| Term               | Definition                                                                        |
| ------------------ | --------------------------------------------------------------------------------- |
| **Hook**           | Function starting with `use` that accesses React features                         |
| **Singleton**      | Design pattern: one instance shared everywhere                                    |
| **ScheduleXEvent** | Event format for Schedule-X calendar: `id`, `title`, `start`, `end`, `calendarId` |
| **DatabaseEvent**  | Event format matching Supabase table schema                                       |
| **Converter**      | Function that transforms one data format to another                               |
| **calendarId**     | Schedule-X property for color-coding by event type                                |
| **ISO 8601**       | Date format: `YYYY-MM-DDTHH:mm:ss±HH:mm`                                          |
| **Nullish**        | `null` or `undefined` (not `0`, `''`, or `false`)                                 |
| **BaaS**           | Backend as a Service (e.g., Supabase, Firebase)                                   |
| **JSX**            | JavaScript XML — HTML-like syntax in React components                             |
| **Props**          | Properties passed from parent to child components                                 |
| **State**          | Component's internal data that triggers re-renders when changed                   |
| **Effect**         | Side effect code that runs after render (useEffect)                               |
| **Fragment**       | `<>...</>` wrapper that doesn't create DOM nodes                                  |
