# Calendar Implementation Guide

> Schedule-X Calendar with Color-Coded Events, Mobile-First Design, and Custom Event Modal

**Date:** January 11, 2026
**Status:** In Progress 🔄
**Library:** Schedule-X (mobile-first, modern React calendar)

---

## Overview

This guide details the implementation of Schedule-X for SalsaSegura.com, including:

- Mobile-first responsive calendar with all views (day/week/month grid/month agenda)
- Color-coded events by type (social, class, workshop) using Schedule-X calendars
- Custom event modal with RSVP support
- Foundation for future database integration and recurring events

---

## Architecture Decisions

### Why Schedule-X?

- ✅ **Built mobile-first** — explicitly responsive design
- ✅ **Modern API** — uses Temporal API for dates
- ✅ **Small bundle size** — ~16 kB core
- ✅ **Very actively maintained** — frequent releases
- ✅ **Built-in dark mode** — matches site theme
- ✅ **Custom components** — can override event modal
- ✅ **Calendars feature** — built-in color-coding by category
- ✅ **Recurrence plugin** — native recurring event support

### Packages Required

| Package                      | Purpose                            |
| ---------------------------- | ---------------------------------- |
| `@schedule-x/react`          | React integration                  |
| `@schedule-x/calendar`       | Core calendar + view creators      |
| `@schedule-x/theme-default`  | Default theme CSS                  |
| `@schedule-x/events-service` | Get/update events programmatically |
| `temporal-polyfill`          | Temporal API polyfill              |

---

## Files to Create/Modify

| Action  | File                             | Purpose                                          |
| ------- | -------------------------------- | ------------------------------------------------ |
| Create  | `/src/types/events.ts`           | Shared TypeScript interfaces and calendar config |
| Rewrite | `/src/components/Calendar.tsx`   | Main calendar component with Schedule-X          |
| Create  | `/src/components/Calendar.css`   | Calendar container and custom styling            |
| Create  | `/src/components/EventModal.tsx` | Custom event detail modal                        |

---

## Step 1: Install Schedule-X Packages

```bash
bun add @schedule-x/react @schedule-x/calendar @schedule-x/theme-default @schedule-x/events-service temporal-polyfill
```

### 📚 Learning Notes: Package Manager & Dependencies

**What is `bun add`?**

Bun is a fast JavaScript runtime and package manager (alternative to npm/yarn). The `add` command installs packages and updates `package.json`.

```bash
# These are equivalent:
bun add package-name    # Bun
npm install package-name # npm
yarn add package-name    # Yarn
```

**Understanding the packages:**

| Package                      | Why We Need It                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `@schedule-x/react`          | React bindings — provides `useCalendarApp` hook and `<ScheduleXCalendar>` component           |
| `@schedule-x/calendar`       | Core library — includes view creators like `createViewMonthGrid()`                            |
| `@schedule-x/theme-default`  | Pre-built CSS theme — without this, the calendar has no styling                               |
| `@schedule-x/events-service` | Plugin for programmatic event access — lets you add/remove/update events after initial render |
| `temporal-polyfill`          | Polyfill for the Temporal API — a modern date/time API that isn't in browsers yet             |

**What is a polyfill?**

A polyfill is code that provides modern functionality to older browsers. The Temporal API is a Stage 3 TC39 proposal (not yet in browsers), so we use `temporal-polyfill` to add it. Once browsers support Temporal natively, you can remove the polyfill.

**Scoped packages (`@scope/package`):**

The `@schedule-x/` prefix is called a "scope". Scopes group related packages under one namespace. Other examples: `@react/`, `@types/`, `@azure/`.

---

## Step 2: Create Shared Types (`/src/types/events.ts`)

```typescript
import "temporal-polyfill/global";

// Event types for the calendar (used as calendarId in Schedule-X)
export type EventType = "social" | "class" | "workshop";

// Schedule-X calendar configuration for color-coding
// Each "calendar" represents an event type with its own colors
export const CALENDARS_CONFIG = {
  social: {
    colorName: "social",
    lightColors: {
      main: "#ff8c42",
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
      main: "#3498db",
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
      main: "#27ae60",
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

// Schedule-X event interface
export interface ScheduleXEvent {
  id: string | number;
  title: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  calendarId: EventType; // Links to CALENDARS_CONFIG for color
  location?: string;
  description?: string;
  // Custom properties for our app
  address?: string;
  rsvpLink?: string;
}

// Helper to create a ZonedDateTime for Boston timezone
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
    timeZone: "America/New_York",
  });
}

// Legacy DanceEvent interface (for Events.tsx compatibility)
export interface DanceEvent {
  id: string;
  title: string;
  type: string;
  month: string;
  day: string;
  time: string;
  location: string;
  address: string;
  description: string;
  rsvpLink: string;
  date: Date;
}

// Convert DanceEvent to ScheduleXEvent (for future unified hook)
export function toScheduleXEvent(
  event: DanceEvent,
  durationHours = 2
): ScheduleXEvent {
  const jsDate = event.date;
  const start = Temporal.ZonedDateTime.from({
    year: jsDate.getFullYear(),
    month: jsDate.getMonth() + 1,
    day: jsDate.getDate(),
    hour: jsDate.getHours(),
    minute: jsDate.getMinutes(),
    second: 0,
    timeZone: "America/New_York",
  });
  const end = start.add({ hours: durationHours });

  const calendarId: EventType = event.type.toLowerCase().includes("social")
    ? "social"
    : event.type.toLowerCase().includes("class")
    ? "class"
    : "workshop";

  return {
    id: event.id,
    title: event.title,
    start,
    end,
    calendarId,
    location: event.location,
    address: event.address,
    description: event.description,
    rsvpLink: event.rsvpLink,
  };
}
```

### 📚 Learning Notes: TypeScript Types & the Temporal API

#### TypeScript Basics Used Here

**1. Type Aliases with `type`:**

```typescript
export type EventType = "social" | "class" | "workshop";
```

This creates a **union type** — a variable of type `EventType` can only be one of these three strings. TypeScript will error if you try to use `"party"`.

**2. Interfaces with `interface`:**

```typescript
export interface ScheduleXEvent {
  id: string | number; // Union: can be string OR number
  title: string; // Required property
  location?: string; // Optional property (the ? makes it optional)
}
```

**When to use `type` vs `interface`?**

- Use `type` for simple unions, primitives, or when you need advanced type features
- Use `interface` for object shapes, especially when they might be extended later
- In practice, they're often interchangeable for object types

**3. The `export` keyword:**

```typescript
export type EventType = ...
export interface ScheduleXEvent { ... }
export function bostonDateTime(...) { ... }
```

`export` makes these available to other files via `import { EventType, ScheduleXEvent } from '../types/events'`.

#### The Temporal API Deep Dive

**Why Temporal exists (problems with `Date`):**

```javascript
// JavaScript Date is confusing:
const date = new Date(2026, 0, 11); // January 11 (month is 0-indexed!)
date.setMonth(1); // Mutates the original object
console.log(date); // Now it's February 11

// Temporal is cleaner:
const temporal = Temporal.PlainDate.from({ year: 2026, month: 1, day: 11 }); // January = 1
const nextMonth = temporal.add({ months: 1 }); // Returns NEW object, original unchanged
```

**Key Temporal types:**

| Type                     | Use Case                                     | Example                                             |
| ------------------------ | -------------------------------------------- | --------------------------------------------------- |
| `Temporal.PlainDate`     | Date only, no time/timezone (e.g., birthday) | `Temporal.PlainDate.from('2026-01-11')`             |
| `Temporal.PlainTime`     | Time only, no date/timezone                  | `Temporal.PlainTime.from('14:30')`                  |
| `Temporal.PlainDateTime` | Date + time, no timezone                     | `Temporal.PlainDateTime.from('2026-01-11T14:30')`   |
| `Temporal.ZonedDateTime` | Date + time + timezone (the most complete)   | See helper function below                           |
| `Temporal.Duration`      | A length of time                             | `Temporal.Duration.from({ hours: 2, minutes: 30 })` |
| `Temporal.Instant`       | A point in time (like Unix timestamp)        | `Temporal.Now.instant()`                            |

**Our `bostonDateTime` helper explained:**

```typescript
export function bostonDateTime(
  year: number,
  month: number, // 1-12 (not 0-11 like Date!)
  day: number,
  hour: number, // 0-23 (24-hour format)
  minute: number = 0 // Default parameter: if not provided, uses 0
): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.from({
    year,
    month,
    day,
    hour,
    minute,
    second: 0,
    timeZone: "America/New_York", // Handles EST/EDT automatically!
  });
}

// Usage:
const eventStart = bostonDateTime(2026, 1, 11, 20, 0); // Jan 11, 2026, 8:00 PM EST
const eventEnd = eventStart.add({ hours: 3 }); // 11:00 PM (immutable!)
```

**Why "America/New_York" instead of "EST"?**

Using IANA timezone names (`America/New_York`) instead of abbreviations (`EST`) is important because:

- Automatically handles Daylight Saving Time transitions
- `EST` is ambiguous (Australia has EST too!)
- JavaScript/Temporal use the IANA database

**Common Temporal operations:**

```typescript
// Create from string
const date = Temporal.PlainDate.from("2026-01-11");

// Create from object
const dateTime = Temporal.ZonedDateTime.from({
  year: 2026,
  month: 1,
  day: 11,
  hour: 20,
  minute: 0,
  second: 0,
  timeZone: "America/New_York",
});

// Duration math
const later = dateTime.add({ hours: 2, minutes: 30 });
const earlier = dateTime.subtract({ days: 1 });

// Comparison
dateTime.equals(later); // false
Temporal.PlainDate.compare(date1, date2); // -1, 0, or 1

// Formatting (uses Intl under the hood)
dateTime.toLocaleString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
}); // "Sunday, January 11"
```

#### Schedule-X Calendars (Color Coding)

**The "calendars" concept can be confusing!**

In Schedule-X, "calendars" doesn't mean multiple calendar views — it means **categories for events**. Each category has its own colors:

```typescript
export const CALENDARS_CONFIG = {
  social: {
    colorName: "social", // Must match the key
    lightColors: {
      // Used when isDark: false
      main: "#ff8c42", // Primary color (event background)
      container: "#ffe4d1", // Lighter version (all-day event bg)
      onContainer: "#5c2e00", // Text color on container
    },
    darkColors: {
      // Used when isDark: true (our site)
      main: "#ffb380",
      container: "#8b4513",
      onContainer: "#ffe4d1",
    },
  },
  // ... class, workshop
};
```

**How events link to calendars:**

```typescript
const event = {
  id: "1",
  title: "Friday Night Social",
  calendarId: "social", // ← This must match a key in CALENDARS_CONFIG!
  // ...
};
```

#### The Converter Function Pattern

**Why `toScheduleXEvent` exists:**

Your existing `Events.tsx` uses a `DanceEvent` interface. The calendar uses `ScheduleXEvent`. Instead of changing all existing code, we create a **converter function**:

```typescript
export function toScheduleXEvent(event: DanceEvent): ScheduleXEvent {
  // Transform old format → new format
}
```

This pattern is called an **adapter** or **transformer**. It's useful when:

- Integrating with external APIs that have different data shapes
- Migrating between data formats gradually
- Keeping components decoupled from data sources

---

## Step 3: Create Calendar CSS (`/src/components/Calendar.css`)

```css
/* Schedule-X calendar container */
.calendar-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  min-height: calc(100vh - 200px);
}

.calendar-container h1 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #fff;
}

/* Calendar wrapper - Schedule-X requires explicit dimensions */
.sx-react-calendar-wrapper {
  width: 100%;
  max-width: 1200px;
  height: 700px;
  max-height: 80vh;
}

/* Calendar legend */
.calendar-legend {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #fff;
  font-size: 0.9rem;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.legend-color.social {
  background: #ff8c42;
}
.legend-color.class {
  background: #3498db;
}
.legend-color.workshop {
  background: #27ae60;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .calendar-container {
    padding: 1rem;
  }

  .calendar-container h1 {
    font-size: 1.5rem;
  }

  .sx-react-calendar-wrapper {
    height: 500px;
  }

  .calendar-legend {
    gap: 1rem;
    font-size: 0.8rem;
  }
}

/* Custom Event Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: linear-gradient(135deg, #2c3e50, #1a252f);
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  border: 1px solid #3498db;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid rgba(52, 152, 219, 0.3);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.modal-header h2 {
  margin: 0;
  color: #fff;
  font-size: 1.5rem;
  line-height: 1.3;
}

.modal-close {
  background: none;
  border: none;
  color: #7f8c8d;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s ease;
}

.modal-close:hover {
  color: #fff;
}

.modal-body {
  padding: 1.5rem;
}

.event-type-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 1rem;
}

.event-type-badge.social {
  background: #ff8c42;
  color: #fff;
}
.event-type-badge.class {
  background: #3498db;
  color: #fff;
}
.event-type-badge.workshop {
  background: #27ae60;
  color: #fff;
}

.event-detail {
  margin-bottom: 1rem;
  color: #bdc3c7;
}

.event-detail-label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #7f8c8d;
  margin-bottom: 0.25rem;
}

.event-detail-value {
  color: #fff;
  font-size: 1rem;
}

.event-description {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(52, 152, 219, 0.3);
  color: #bdc3c7;
  line-height: 1.6;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid rgba(52, 152, 219, 0.3);
}

.rsvp-button {
  display: block;
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #ff8c42, #e74c3c);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.rsvp-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(255, 140, 66, 0.4);
}
```

### 📚 Learning Notes: CSS Techniques & Layout Patterns

#### CSS Custom Properties We Could Use

While this guide uses hardcoded colors, a production app might use CSS custom properties (variables):

```css
:root {
  --color-social: #ff8c42;
  --color-class: #3498db;
  --color-workshop: #27ae60;
}

.legend-color.social {
  background: var(--color-social);
}
```

This makes theming easier — change one variable, update everywhere.

#### Key Layout Patterns

**1. Container Pattern:**

```css
.calendar-container {
  max-width: 1200px; /* Don't stretch too wide on large screens */
  margin: 0 auto; /* Center horizontally */
  padding: 2rem; /* Inner spacing */
}
```

This is the classic "centered container" pattern used in almost every website.

**2. The `calc()` Function:**

```css
min-height: calc(100vh - 200px);
```

`calc()` lets you mix units and do math. Here: "100% of viewport height minus 200px for header/footer". This ensures the calendar area always fills the screen.

**3. Flexbox for Legends:**

```css
.calendar-legend {
  display: flex; /* Horizontal layout */
  justify-content: center; /* Center items horizontally */
  gap: 2rem; /* Space between items (no margin hacks!) */
  flex-wrap: wrap; /* Wrap to next line on small screens */
}
```

`gap` is modern CSS — it replaces the old `margin-right` hack for spacing flex items.

#### The Modal Pattern (CSS)

**1. Fixed Overlay:**

```css
.modal-overlay {
  position: fixed; /* Stays in place when scrolling */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0; /* Covers entire viewport */
  background: rgba(0, 0, 0, 0.75); /* Semi-transparent black */
  z-index: 1000; /* Above everything else */
}
```

**2. Centering the Modal Content:**

```css
.modal-overlay {
  display: flex;
  align-items: center; /* Vertical center */
  justify-content: center; /* Horizontal center */
}
```

Flexbox makes centering trivial — this was much harder before flexbox existed!

**3. Gradients for Visual Depth:**

```css
.modal-content {
  background: linear-gradient(135deg, #2c3e50, #1a252f);
}
```

`linear-gradient(angle, color1, color2)` creates a smooth color transition. `135deg` goes from top-left to bottom-right.

**4. Smooth Hover Effects:**

```css
.rsvp-button {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.rsvp-button:hover {
  transform: translateY(-2px); /* Lift up slightly */
  box-shadow: 0 4px 15px rgba(255, 140, 66, 0.4); /* Add glow */
}
```

The `transition` property animates changes. Without it, the hover effect would be instant (jarring).

#### Schedule-X CSS Requirements

**Critical: The calendar needs an explicit height!**

```css
.sx-react-calendar-wrapper {
  width: 100%;
  height: 700px; /* Required! Without this, the calendar won't render */
  max-height: 80vh;
}
```

Schedule-X uses `height: 100%` internally. If the parent has no height, `100%` of nothing is nothing, so the calendar collapses to 0px.

#### Mobile-First Media Queries

```css
/* Mobile styles first (default) */
.calendar-container {
  padding: 1rem;
}

/* Then add desktop overrides */
@media (min-width: 768px) {
  .calendar-container {
    padding: 2rem;
  }
}
```

Wait — our CSS does it backwards! That's okay for this project, but true mobile-first means:

1. Write mobile styles as default
2. Use `min-width` media queries for larger screens

Our current approach uses `max-width` (desktop-first), which works but isn't ideal.

#### CSS Units Cheat Sheet

| Unit  | What It Means                     | Best For                     |
| ----- | --------------------------------- | ---------------------------- |
| `px`  | Absolute pixels                   | Borders, small fixed spacing |
| `rem` | Relative to root font size (16px) | Font sizes, padding, margins |
| `em`  | Relative to parent font size      | Text-related spacing         |
| `%`   | Percentage of parent              | Fluid widths                 |
| `vh`  | 1% of viewport height             | Full-screen sections         |
| `vw`  | 1% of viewport width              | Full-width elements          |

**Why `rem` over `px`?**

If a user changes their browser's base font size (accessibility), `rem` units scale accordingly. `px` does not.

---

## Step 4: Create Event Modal (`/src/components/EventModal.tsx`)

```tsx
import { ScheduleXEvent } from "../types/events";

interface EventModalProps {
  event: ScheduleXEvent | null;
  onClose: () => void;
}

export default function EventModal({ event, onClose }: EventModalProps) {
  if (!event) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Format date and time from Temporal.ZonedDateTime
  const formatDate = (dt: Temporal.ZonedDateTime) => {
    return dt.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (
    start: Temporal.ZonedDateTime,
    end: Temporal.ZonedDateTime
  ) => {
    const startTime = start.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const endTime = end.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${startTime} - ${endTime}`;
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 id="modal-title">{event.title}</h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <span className={`event-type-badge ${event.calendarId}`}>
            {event.calendarId}
          </span>

          <div className="event-detail">
            <span className="event-detail-label">Date</span>
            <span className="event-detail-value">
              {formatDate(event.start)}
            </span>
          </div>

          <div className="event-detail">
            <span className="event-detail-label">Time</span>
            <span className="event-detail-value">
              {formatTime(event.start, event.end)}
            </span>
          </div>

          {event.location && (
            <div className="event-detail">
              <span className="event-detail-label">Location</span>
              <span className="event-detail-value">{event.location}</span>
            </div>
          )}

          {event.address && (
            <div className="event-detail">
              <span className="event-detail-label">Address</span>
              <span className="event-detail-value">{event.address}</span>
            </div>
          )}

          {event.description && (
            <div className="event-description">
              <p>{event.description}</p>
            </div>
          )}
        </div>

        {event.rsvpLink && (
          <div className="modal-footer">
            <a
              href={event.rsvpLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rsvp-button"
            >
              RSVP Now
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 📚 Learning Notes: React Component Patterns & Accessibility

#### Component Props Pattern

**Defining Props with TypeScript:**

```tsx
interface EventModalProps {
  event: ScheduleXEvent | null; // Can be an event OR null
  onClose: () => void; // Function that takes no args, returns nothing
}

export default function EventModal({ event, onClose }: EventModalProps) {
  // Destructure props in the function signature
}
```

**The `| null` pattern:**

Allows the parent component to pass `null` when no event is selected. The modal handles this with an early return:

```tsx
if (!event) return null; // Render nothing if no event
```

This is called a **guard clause** or **early return** — check for invalid states first, then proceed with the main logic.

#### Event Handling in React

**1. The Backdrop Click Pattern:**

```tsx
const handleBackdropClick = (e: React.MouseEvent) => {
  if (e.target === e.currentTarget) {
    onClose();
  }
};
```

**Why check `e.target === e.currentTarget`?**

- `e.target` — the element that was actually clicked
- `e.currentTarget` — the element the handler is attached to (the overlay)

Without this check, clicking the modal content would also close it (because the click bubbles up to the overlay). This ensures only clicking the dark backdrop closes the modal.

**2. The `onClick` handler:**

```tsx
<div className="modal-overlay" onClick={handleBackdropClick}>
```

In React, event handlers use camelCase (`onClick`, not `onclick`).

#### Conditional Rendering Patterns

**1. Short-circuit evaluation (`&&`):**

```tsx
{
  event.location && (
    <div className="event-detail">
      <span>{event.location}</span>
    </div>
  );
}
```

If `event.location` is truthy, render the JSX. If falsy (undefined, null, empty string), render nothing.

**2. Ternary operator (`? :`):**

```tsx
{
  isLoading ? <Spinner /> : <Content />;
}
```

Use when you have two possible outputs.

**3. Early return:**

```tsx
if (!event) return null;
```

Use when the entire component shouldn't render.

#### Temporal Formatting

**Using `toLocaleString` with Temporal:**

```tsx
const formatDate = (dt: Temporal.ZonedDateTime) => {
  return dt.toLocaleString("en-US", {
    weekday: "long", // "Sunday"
    year: "numeric", // "2026"
    month: "long", // "January"
    day: "numeric", // "11"
  });
}; // Result: "Sunday, January 11, 2026"
```

This uses the `Intl` API under the hood. Options include:

| Option    | Values                                        |
| --------- | --------------------------------------------- |
| `weekday` | `"narrow"`, `"short"`, `"long"`               |
| `year`    | `"numeric"`, `"2-digit"`                      |
| `month`   | `"numeric"`, `"2-digit"`, `"short"`, `"long"` |
| `day`     | `"numeric"`, `"2-digit"`                      |
| `hour`    | `"numeric"`, `"2-digit"`                      |
| `minute`  | `"numeric"`, `"2-digit"`                      |
| `hour12`  | `true` (AM/PM) or `false` (24-hour)           |

#### Accessibility (a11y) Attributes

**Our modal uses these accessibility attributes:**

```tsx
<div
  role="dialog"              // Tells screen readers this is a dialog
  aria-modal="true"          // Indicates it's a modal (focus should be trapped)
  aria-labelledby="modal-title"  // Points to the element that labels this dialog
>
  <h2 id="modal-title">{event.title}</h2>  // The label target
  <button aria-label="Close modal">×</button>  // Describes button purpose
```

**Why this matters:**

- Screen readers announce "dialog" when entering
- Users know there's a modal open
- The `×` button is announced as "Close modal" not just "×"

**Common accessibility patterns:**

- Always add `alt` to images
- Use semantic HTML (`<button>`, not `<div onClick>`)
- Ensure color contrast meets WCAG standards
- Support keyboard navigation (Tab, Enter, Escape)

#### Security: External Links

```tsx
<a
  href={event.rsvpLink}
  target="_blank"              // Opens in new tab
  rel="noopener noreferrer"    // Security!
>
```

**Why `rel="noopener noreferrer"`?**

- `noopener` — Prevents the new page from accessing `window.opener` (security risk)
- `noreferrer` — Doesn't send the `Referer` header (privacy)

Without `noopener`, a malicious site could redirect your original page via `window.opener.location`.

#### React.MouseEvent Type

```tsx
const handleBackdropClick = (e: React.MouseEvent) => {
```

React provides its own event types that wrap native events. Common ones:

- `React.MouseEvent` — clicks, mouse movement
- `React.KeyboardEvent` — key presses
- `React.ChangeEvent<HTMLInputElement>` — form inputs
- `React.FormEvent` — form submission

These provide type safety and cross-browser consistency.

---

## Step 5: Rewrite Calendar Component (`/src/components/Calendar.tsx`)

```tsx
import { useState, useEffect } from "react";
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
  createViewMonthAgenda,
} from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import "temporal-polyfill/global";
import "@schedule-x/theme-default/dist/index.css";
import "./Calendar.css";

import {
  ScheduleXEvent,
  CALENDARS_CONFIG,
  bostonDateTime,
} from "../types/events";
import EventModal from "./EventModal";

// Test events for development (January 2026)
const testEvents: ScheduleXEvent[] = [
  {
    id: "1",
    title: "Beginner Salsa Class",
    start: bostonDateTime(2026, 1, 11, 14, 0), // Jan 11, 2026 2:00 PM
    end: bostonDateTime(2026, 1, 11, 15, 0), // 1 hour
    calendarId: "class",
    location: "Dance Studio Boston",
    address: "123 Boylston St, Boston, MA 02116",
    description:
      "Learn the basics of salsa dancing! Perfect for absolute beginners.",
    rsvpLink: "https://example.com/rsvp",
  },
  {
    id: "2",
    title: "Friday Night Social",
    start: bostonDateTime(2026, 1, 16, 20, 0), // Jan 16, 2026 8:00 PM
    end: bostonDateTime(2026, 1, 17, 0, 0), // 4 hours (ends midnight)
    calendarId: "social",
    location: "Havana Club",
    address: "456 Commonwealth Ave, Boston, MA 02215",
    description:
      "Join us for a night of salsa, bachata, and good vibes! DJ Pedro spinning the best Latin hits.",
    rsvpLink: "https://example.com/friday-social",
  },
  {
    id: "3",
    title: "Bachata Styling Workshop",
    start: bostonDateTime(2026, 1, 17, 15, 0), // Jan 17, 2026 3:00 PM
    end: bostonDateTime(2026, 1, 17, 16, 30), // 1.5 hours
    calendarId: "workshop",
    location: "Latin Dance Academy",
    address: "789 Newbury St, Boston, MA 02115",
    description:
      "Master body movement and styling techniques for bachata. Intermediate level.",
    rsvpLink: "https://example.com/bachata-workshop",
  },
  {
    id: "4",
    title: "Intermediate Salsa Class",
    start: bostonDateTime(2026, 1, 14, 19, 0), // Jan 14, 2026 7:00 PM
    end: bostonDateTime(2026, 1, 14, 20, 0), // 1 hour
    calendarId: "class",
    location: "Dance Studio Boston",
    address: "123 Boylston St, Boston, MA 02116",
    description:
      "Take your salsa to the next level! Focus on turn patterns and musicality.",
    rsvpLink: "https://example.com/intermediate-salsa",
  },
  {
    id: "5",
    title: "Saturday Night Salsa Social",
    start: bostonDateTime(2026, 1, 24, 21, 0), // Jan 24, 2026 9:00 PM
    end: bostonDateTime(2026, 1, 25, 1, 0), // 4 hours
    calendarId: "social",
    location: "Rumba Room",
    address: "321 Tremont St, Boston, MA 02116",
    description: "The biggest salsa social in Boston! Live band performance.",
    rsvpLink: "https://example.com/saturday-social",
  },
];

export default function Calendar() {
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(
    null
  );

  // Initialize events service plugin
  const [eventsService] = useState(() => createEventsServicePlugin());

  // Initialize calendar
  const calendar = useCalendarApp({
    views: [
      createViewDay(),
      createViewWeek(),
      createViewMonthGrid(),
      createViewMonthAgenda(),
    ],
    events: testEvents,
    calendars: CALENDARS_CONFIG,
    plugins: [eventsService],
    selectedDate: Temporal.PlainDate.from("2026-01-11"),
    isDark: true, // Match site's dark theme
    locale: "en-US",
    firstDayOfWeek: 0, // Sunday
    callbacks: {
      onEventClick(calendarEvent) {
        // Find the full event with our custom properties
        const fullEvent = testEvents.find((e) => e.id === calendarEvent.id);
        if (fullEvent) {
          setSelectedEvent(fullEvent);
        }
      },
    },
  });

  // Close modal
  const handleCloseModal = () => {
    setSelectedEvent(null);
  };

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedEvent(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="calendar-container">
      <h1>Boston Salsa Events Calendar</h1>

      {/* Legend */}
      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-color social"></span>
          <span>Social Dance</span>
        </div>
        <div className="legend-item">
          <span className="legend-color class"></span>
          <span>Class</span>
        </div>
        <div className="legend-item">
          <span className="legend-color workshop"></span>
          <span>Workshop</span>
        </div>
      </div>

      {/* Schedule-X Calendar */}
      <ScheduleXCalendar calendarApp={calendar} />

      {/* Event Detail Modal */}
      <EventModal event={selectedEvent} onClose={handleCloseModal} />
    </div>
  );
}
```

### 📚 Learning Notes: React Hooks & Schedule-X Integration

#### React Hooks Overview

**What are hooks?**

Hooks are functions that let you "hook into" React features. They always start with `use` and can only be called at the top level of a component (not inside loops, conditions, or nested functions).

**Hooks used in this component:**

| Hook             | Purpose                                           |
| ---------------- | ------------------------------------------------- |
| `useState`       | Store and update component state                  |
| `useEffect`      | Run side effects (subscriptions, event listeners) |
| `useCalendarApp` | Schedule-X's custom hook (creates calendar app)   |

#### useState Deep Dive

**Basic usage:**

```tsx
const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(null);
//      ↑ current value  ↑ setter function            ↑ TypeScript type    ↑ initial value
```

**What happens when you call `setSelectedEvent`:**

1. React schedules a re-render
2. On re-render, `selectedEvent` has the new value
3. UI updates to reflect the change

**Important: State is immutable!**

```tsx
// ❌ Wrong - mutating state directly
selectedEvent.title = "New Title";

// ✅ Right - create a new object
setSelectedEvent({ ...selectedEvent, title: "New Title" });
```

**useState with functions (lazy initialization):**

```tsx
const [eventsService] = useState(() => createEventsServicePlugin());
//                               ↑ Function that runs ONCE on first render
```

Passing a function to `useState` means it only runs on the initial render, not on every re-render. This is efficient for expensive operations.

#### useEffect Deep Dive

**Purpose:** Run code that has "side effects" — things outside React's render cycle like:

- Event listeners
- API calls
- Subscriptions
- Timers

**Our keyboard handler:**

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setSelectedEvent(null);
    }
  };

  window.addEventListener("keydown", handleKeyDown); // Subscribe

  return () => window.removeEventListener("keydown", handleKeyDown); // Cleanup!
}, []); // Empty dependency array = run once on mount
```

**The cleanup function:**

The function returned from `useEffect` runs when:

1. The component unmounts
2. Before the effect runs again (if dependencies change)

Without cleanup, you'd add a new listener on every render → memory leak!

**The dependency array:**

```tsx
useEffect(() => { ... }, []);           // Run once on mount
useEffect(() => { ... }, [selectedEvent]); // Run when selectedEvent changes
useEffect(() => { ... });                // Run on every render (usually wrong!)
```

#### The useCalendarApp Hook

**Schedule-X's custom hook:**

```tsx
const calendar = useCalendarApp({
  views: [
    createViewDay(),
    createViewWeek(),
    createViewMonthGrid(),
    createViewMonthAgenda(),
  ],
  events: testEvents,
  calendars: CALENDARS_CONFIG,
  plugins: [eventsService],
  selectedDate: Temporal.PlainDate.from("2026-01-11"),
  isDark: true,
  locale: "en-US",
  firstDayOfWeek: 0,  // 0 = Sunday, 1 = Monday
  callbacks: {
    onEventClick(calendarEvent) { ... },
  },
});
```

**Configuration breakdown:**

| Property         | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `views`          | Which views are available (user can switch between them) |
| `events`         | Initial array of events to display                       |
| `calendars`      | Color configurations for event categories                |
| `plugins`        | Additional functionality (events service, recurrence)    |
| `selectedDate`   | Which date to show initially                             |
| `isDark`         | Enable dark mode styling                                 |
| `locale`         | Language/formatting (affects date strings, first day)    |
| `firstDayOfWeek` | 0-6, where 0 is Sunday                                   |
| `callbacks`      | Functions called on user interactions                    |

**The returned `calendar` object:**

```tsx
<ScheduleXCalendar calendarApp={calendar} />
```

This is a React component that receives the calendar configuration. Schedule-X handles all the rendering internally.

#### The Callback Pattern

**onEventClick:**

```tsx
callbacks: {
  onEventClick(calendarEvent) {
    // calendarEvent has id, title, start, end, calendarId
    // But NOT our custom properties (location, address, rsvpLink)!

    // So we find the full event from our array:
    const fullEvent = testEvents.find((e) => e.id === calendarEvent.id);
    if (fullEvent) {
      setSelectedEvent(fullEvent);
    }
  },
}
```

**Why this lookup is necessary:**

Schedule-X's internal event type doesn't include custom properties. We store our full events in `testEvents` and look them up by ID when clicked.

#### Import Organization

**Good import order:**

```tsx
// 1. React itself
import { useState, useEffect } from "react";

// 2. Third-party libraries
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import { createViewDay, createViewWeek, ... } from "@schedule-x/calendar";

// 3. Side effects (polyfills, CSS)
import "temporal-polyfill/global";
import "@schedule-x/theme-default/dist/index.css";
import "./Calendar.css";

// 4. Local modules (types, components)
import { ScheduleXEvent, CALENDARS_CONFIG, bostonDateTime } from "../types/events";
import EventModal from "./EventModal";
```

Many projects use ESLint rules to enforce this order automatically.

#### Creating Test Data

**Our test events follow a pattern:**

```tsx
const testEvents: ScheduleXEvent[] = [
  {
    id: "1", // Unique identifier
    title: "Beginner Salsa Class", // Display name
    start: bostonDateTime(2026, 1, 11, 14, 0), // When it starts
    end: bostonDateTime(2026, 1, 11, 15, 0), // When it ends
    calendarId: "class", // Category (for color)
    location: "Dance Studio Boston", // Venue name
    address: "123 Boylston St, Boston, MA", // Physical address
    description: "Learn the basics...", // Details
    rsvpLink: "https://example.com/rsvp", // Call to action
  },
  // ... more events
];
```

**Tips for test data:**

- Use realistic data (helps catch edge cases)
- Include edge cases: events spanning midnight, long titles, missing optional fields
- Use dates in the future to avoid confusion

#### Component Composition

**Our component structure:**

```tsx
<div className="calendar-container">
  <h1>Boston Salsa Events Calendar</h1>
  <div className="calendar-legend">...</div>           {/* Static legend */}
  <ScheduleXCalendar calendarApp={calendar} />         {/* Third-party component */}
  <EventModal event={selectedEvent} onClose={...} />   {/* Our custom component */}
</div>
```

**Component composition** means building complex UIs from smaller, reusable pieces. Each component has a single responsibility:

- `Calendar.tsx` — Manages state, passes data to children
- `EventModal.tsx` — Displays event details, handles close action
- `ScheduleXCalendar` — Renders the calendar (we don't touch its internals)

---

## Step 6: Future Enhancements

### Recurring Events (Week 15)

Schedule-X has a native recurrence plugin:

```bash
bun add @schedule-x/recurrence
```

```typescript
import { createRecurrencePlugin } from "@schedule-x/recurrence";

// Add to plugins array
plugins: [eventsService, createRecurrencePlugin()],
  // Event with recurrence
  {
    id: "6",
    title: "Weekly Beginner Class",
    start: bostonDateTime(2026, 1, 11, 14, 0),
    end: bostonDateTime(2026, 1, 11, 15, 0),
    calendarId: "class",
    rrule: "FREQ=WEEKLY;BYDAY=SA;COUNT=10", // Every Saturday for 10 weeks
  };
```

### Database Integration (Week 3)

Update the `fetchEvents` callback to load from Supabase:

```typescript
callbacks: {
  async fetchEvents(range) {
    const { data } = await supabase
      .from('events')
      .select('*')
      .gte('event_date', range.start)
      .lte('event_date', range.end);
    return data.map(toScheduleXEvent);
  },
}
```

### Event Detail Pages (Week 11)

Add React Router route for `/events/:id` for shareable event links.

---

## Test Checklist

- [ ] Calendar displays on `/calendar` route
- [ ] All views work (day, week, month grid, month agenda)
- [ ] Events are color-coded by type (orange/blue/green)
- [ ] Clicking event opens custom modal
- [ ] Modal displays all event details
- [ ] RSVP button links correctly
- [ ] Dark mode is enabled
- [ ] Mobile layout is responsive
- [ ] Legend is visible
- [ ] ESC closes modal
- [ ] Backdrop click closes modal

---

## Troubleshooting

### Calendar not rendering

- Ensure `temporal-polyfill/global` is imported before using Temporal
- Check that `.sx-react-calendar-wrapper` has explicit height in CSS
- Verify all Schedule-X packages are installed

### Events not showing

- Ensure `start` and `end` are `Temporal.ZonedDateTime` objects
- Check that `calendarId` matches a key in `CALENDARS_CONFIG`
- Verify dates are in the current view range

### Colors not applying

- Ensure `colorName` in calendar config matches the key (e.g., 'social')
- Check that `isDark: true` is set if using dark mode colors

### Mobile layout issues

- Schedule-X is mobile-first, but ensure container has proper width
- Set `isResponsive: true` (default) for automatic view switching

---

## References

- [Schedule-X React Docs](https://schedule-x.dev/docs/frameworks/react)
- [Schedule-X Events](https://schedule-x.dev/docs/calendar/events)
- [Schedule-X Calendars (Color Coding)](https://schedule-x.dev/docs/calendar/calendars)
- [Schedule-X Configuration](https://schedule-x.dev/docs/calendar/configuration)
- [Schedule-X Recurrence Plugin](https://schedule-x.dev/docs/calendar/plugins/recurrence)
- [Temporal API](https://tc39.es/proposal-temporal/docs/)

---

## 🎓 Skills Summary

By completing this implementation, you practiced:

| Skill                            | Where You Learned It  |
| -------------------------------- | --------------------- |
| Package management with Bun      | Step 1 Learning Notes |
| TypeScript types & interfaces    | Step 2 Learning Notes |
| The Temporal API                 | Step 2 Learning Notes |
| CSS layout patterns              | Step 3 Learning Notes |
| Responsive design                | Step 3 Learning Notes |
| React event handling             | Step 4 Learning Notes |
| Accessibility (a11y)             | Step 4 Learning Notes |
| Conditional rendering            | Step 4 Learning Notes |
| React hooks (useState/useEffect) | Step 5 Learning Notes |
| Component composition            | Step 5 Learning Notes |
| Third-party library integration  | Step 5 Learning Notes |

**Next steps to deepen your learning:**

1. Add your own test events with different durations
2. Try changing the color scheme in `CALENDARS_CONFIG`
3. Experiment with different Temporal methods (`subtract`, `until`, `since`)
4. Add keyboard navigation to the modal (focus trapping)
5. Implement the recurring events plugin (Step 6)
