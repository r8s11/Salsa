# Boston Salsa Calendar - Developer Guide

## Overview

This project is a React-based calendar application for displaying salsa, bachata, and Latin dance events in Boston. It uses [Schedule-X](https://schedule-x.dev/) as the calendar component library.

## Project Structure

```
src/
├── components/
│   ├── calendar.tsx      # Main calendar component
│   └── Calendar.css      # Calendar styles
├── types/
│   └── events.ts         # Event types and utilities
└── App.tsx               # App layout (header/main/footer)
```

> 💡 **React Learning Note — Component Organization**
>
> React apps are organized into **components** — reusable pieces of UI:
>
> ```
> src/
> ├── components/     # Reusable UI pieces
> │   ├── Button.tsx
> │   ├── Calendar.tsx
> │   └── Header.tsx
> ├── pages/          # Full pages (compose components)
> │   ├── HomePage.tsx
> │   └── AboutPage.tsx
> ├── hooks/          # Custom hooks (shared logic)
> │   └── useEvents.ts
> ├── types/          # TypeScript types/interfaces
> │   └── events.ts
> └── App.tsx         # Root component
> ```
>
> **Why this structure?**
>
> - **components/**: Small, reusable (Button, Card, Modal)
> - **pages/**: One per route, compose components
> - **hooks/**: Share logic between components
> - **types/**: Share TypeScript definitions
>
> **Naming conventions:**
>
> - Components: `PascalCase` (e.g., `Calendar.tsx`)
> - One component per file (usually)
> - CSS file matches component: `Calendar.css`

## Event Types

The calendar supports three event categories:

| Type       | Description                      |
| ---------- | -------------------------------- |
| `social`   | Dance socials and parties        |
| `class`    | Regular dance classes            |
| `workshop` | Special workshops and intensives |

## Adding Events

**Step-by-step to add a new event:**

1. Open your events file (e.g., `src/data/events.ts` or your hook)
2. Create an object matching the `ScheduleXEvent` interface
3. Add it to your events array
4. The calendar will automatically display it

### Event Format

Events use the `ScheduleXEvent` interface:

```typescript
interface ScheduleXEvent {
  id: string | number;
  title: string;
  start: string; // Format: "YYYY-MM-DD HH:mm"
  end: string; // Format: "YYYY-MM-DD HH:mm"
  calendarId: EventType; // "social" | "class" | "workshop"
  location?: string;
  description?: string;
  address?: string;
  rsvpLink?: string;
}
```

> 💡 **JS/TS Learning Note — Interfaces**
>
> An **interface** defines the shape of an object — what properties it must have and their types.
>
> ```typescript
> // Without interface: TypeScript doesn't know what shape `event` should be
> const event = { title: "Salsa Night" }; // ❓ What else is needed?
>
> // With interface: TypeScript enforces the structure
> const event: ScheduleXEvent = {
>   id: "1", // ✅ Required
>   title: "Salsa", // ✅ Required
>   // ❌ TypeScript error: missing 'start', 'end', 'calendarId'
> };
> ```
>
> **Optional properties** use `?`:
>
> - `location?: string` means location CAN be missing
> - `location: string` means location is REQUIRED

> 💡 **JS/TS Learning Note — Union Types**
>
> The `|` symbol creates a **union type** — the value can be ANY of the listed types:
>
> ```typescript
> id: string | number; // Can be "abc" OR 123
> calendarId: "social" | "class" | "workshop"; // ONLY these 3 strings
> ```
>
> This is called a **literal union type** — it restricts values to specific strings.

### Example Event

```typescript
{
  id: "1",
  title: "Beginner Salsa Class",
  start: "2026-01-15 19:00",
  end: "2026-01-15 20:00",
  calendarId: "class",
  location: "Dance Studio Boston",
  address: "123 Boylston St, Boston, MA 02116",
  description: "Learn the basics of salsa dancing!",
  rsvpLink: "https://example.com/rsvp",
}
```

## Date/Time Handling

### Recommended: Simple ISO Strings

For Schedule-X compatibility, use simple date strings:

```typescript
start: "2026-01-15 19:00",
end: "2026-01-15 20:00",
```

### Alternative: Temporal API

The project includes a `bostonDateTime` helper for timezone-aware dates:

```typescript
import { bostonDateTime } from "../types/events";

// Creates a ZonedDateTime for Boston (America/New_York)
const eventStart = bostonDateTime(2026, 1, 15, 19, 0);
```

> 💡 **JS/TS Learning Note — Import/Export**
>
> **Exporting** makes code available to other files:
>
> ```typescript
> // In types/events.ts
> export function bostonDateTime(...) { ... }  // Named export
> export default CALENDARS_CONFIG;             // Default export
> ```
>
> **Importing** brings that code into your file:
>
> ```typescript
> import { bostonDateTime } from "../types/events"; // Named import (curly braces)
> import CALENDARS_CONFIG from "../types/events"; // Default import (no braces)
> ```
>
> **Path rules:**
>
> - `"../types/events"` — Go UP one folder (`..`), then into `types/events.ts`
> - `"./events"` — Same folder
> - `"@supabase/supabase-js"` — From `node_modules` (external package)

> **Note:** When using Temporal objects, ensure they are converted to strings before passing to Schedule-X.

## Calendar Configuration

### Views Available

- Day view
- Week view
- Month grid
- Month agenda

### Customizing Colors

**Step-by-step to change event colors:**

1. Open `src/types/events.ts`
2. Find the `CALENDARS_CONFIG` object
3. Modify the color values for your desired event type
4. Save and refresh to see changes

Edit `CALENDARS_CONFIG` in `src/types/events.ts`:

```typescript
export const CALENDARS_CONFIG = {
  social: {
    colorName: "social",
    lightColors: {
      main: "#ffec42",
      container: "#ffe4d1",
      onContainer: "#5c2e00",
    },
    darkColors: {
      main: "#ffb380",
      container: "#8b4513",
      onContainer: "#ffe4d1",
    },
  },
  // Add more event types...
};
```

> 💡 **JS/TS Learning Note — Object Literals**
>
> An **object literal** is a way to define an object with key-value pairs:
>
> ```typescript
> const myObject = {
>   key1: "value1", // String value
>   key2: 42, // Number value
>   nested: {
>     // Nested object
>     inner: "value",
>   },
> };
>
> // Accessing values:
> myObject.key1; // "value1" (dot notation)
> myObject["key1"]; // "value1" (bracket notation)
> myObject.nested.inner; // "value" (chaining)
> ```
>
> **`const` vs `let`:**
>
> - `const` = can't reassign the variable (but CAN modify object contents)
> - `let` = can reassign the variable
>
> ```typescript
> const obj = { a: 1 };
> obj.a = 2; // ✅ OK — modifying contents
> obj = { a: 3 }; // ❌ Error — can't reassign const
> ```

## Layout Structure

The app uses a CSS Grid layout:

```css
.app-layout {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}
```

- **Header**: Navigation and branding
- **Main**: Calendar component (fills available space)
- **Footer**: Copyright and links

> 💡 **CSS Learning Note — Grid Layout**
>
> CSS Grid is a powerful 2D layout system:
>
> ```css
> grid-template-rows: auto 1fr auto;
> /*                   │    │   └── Footer: shrink to content height
>                      │    └── Main: take ALL remaining space (1fr)
>                      └── Header: shrink to content height
> */
> ```
>
> **What `fr` means:**
>
> - `fr` = "fraction" of available space
> - `1fr` = take 1 part of remaining space
> - `2fr 1fr` = first takes 2 parts, second takes 1 part
>
> **What `auto` means:**
>
> - `auto` = size based on content
> - Header/footer shrink to fit their content
>
> **What `100vh` means:**
>
> - `vh` = viewport height (browser window height)
> - `100vh` = full screen height
> - Makes the layout fill the entire screen

## Running the Project

**Step-by-step to run locally:**

1. Open your terminal in the project folder
2. Install dependencies:
   ```bash
   bun install
   ```
3. Start the development server:
   ```bash
   bun run dev
   ```
4. Open `http://localhost:5173` in your browser
5. Make changes and see them update automatically (hot reload)

**To build for production:**

```bash
bun run build
```

> 💡 **JS/TS Learning Note — Package Managers**
>
> **What is Bun?**
> A fast JavaScript runtime and package manager. It replaces both Node.js AND npm.
>
> **Common commands:**
> | Command | What it does |
> |---------|-------------|
> | `bun install` | Download all packages listed in `package.json` |
> | `bun add pkg` | Add a new package to your project |
> | `bun add -d pkg` | Add a dev-only package (testing, building) |
> | `bun run dev` | Run the "dev" script from `package.json` |
>
> **What is `package.json`?**
> A file that lists your project's dependencies and scripts:
>
> ```json
> {
>   "scripts": {
>     "dev": "vite", // bun run dev → runs vite
>     "build": "vite build" // bun run build → runs vite build
>   },
>   "dependencies": {
>     "react": "^18.2.0" // Your project needs React
>   }
> }
> ```

## Dependencies

| Package                      | Purpose                   |
| ---------------------------- | ------------------------- |
| `@schedule-x/react`          | React calendar component  |
| `@schedule-x/calendar`       | Calendar views            |
| `@schedule-x/events-service` | Event management plugin   |
| `@schedule-x/theme-default`  | Default dark/light themes |
| `temporal-polyfill`          | Temporal API polyfill     |

## Common Issues

### Time Displaying Incorrectly

Use simple string format (`"YYYY-MM-DD HH:mm"`) instead of Temporal objects directly.

### Calendar Not Centering

Ensure the calendar wrapper has:

```css
max-width: 1200px;
margin: 0 auto;
```

### Events Not Showing

1. Check `calendarId` matches a key in `CALENDARS_CONFIG`
2. Verify date format is correct
3. Ensure `selectedDate` is within the event date range
