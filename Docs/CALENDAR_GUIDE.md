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

## Event Types

The calendar supports three event categories:

| Type       | Description                          |
|------------|--------------------------------------|
| `social`   | Dance socials and parties            |
| `class`    | Regular dance classes                |
| `workshop` | Special workshops and intensives     |

## Adding Events

### Event Format

Events use the `ScheduleXEvent` interface:

```typescript
interface ScheduleXEvent {
  id: string | number;
  title: string;
  start: string;              // Format: "YYYY-MM-DD HH:mm"
  end: string;                // Format: "YYYY-MM-DD HH:mm"
  calendarId: EventType;      // "social" | "class" | "workshop"
  location?: string;
  description?: string;
  address?: string;
  rsvpLink?: string;
}
```

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

> **Note:** When using Temporal objects, ensure they are converted to strings before passing to Schedule-X.

## Calendar Configuration

### Views Available

- Day view
- Week view
- Month grid
- Month agenda

### Customizing Colors

Edit `CALENDARS_CONFIG` in `src/types/events.ts`:

```typescript
export const CALENDARS_CONFIG = {
  social: {
    colorName: "social",
    lightColors: { main: "#ffec42", container: "#ffe4d1", onContainer: "#5c2e00" },
    darkColors: { main: "#ffb380", container: "#8b4513", onContainer: "#ffe4d1" },
  },
  // Add more event types...
};
```

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

## Running the Project

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Dependencies

| Package                    | Purpose                    |
|----------------------------|----------------------------|
| `@schedule-x/react`        | React calendar component   |
| `@schedule-x/calendar`     | Calendar views             |
| `@schedule-x/events-service` | Event management plugin  |
| `@schedule-x/theme-default`| Default dark/light themes  |
| `temporal-polyfill`        | Temporal API polyfill      |

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