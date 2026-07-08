# Salsa Segura — Design Sync Notes

## Shape
- Package shape, tokens-only. This is a React web app, not a component library.
- All React components excluded via `componentSrcMap` — they're tightly coupled to React Router, CityContext, and live Supabase connections, making them un-bundlable for standalone preview.
- `--entry .design-sync/tokens-entry.ts` (empty module) bypasses synth-entry src scan.

## Fonts
- Epilogue, Be Vietnam Pro, Great Vibes — served from Google Fonts via `<link>` tag in `index.html`.
- `styles-with-fonts.css` wraps `global.css` with a `@import url(https://fonts.googleapis.com/...)` so the design agent can render the correct typography.
- `[FONT_REMOTE]` in validate output is expected (informational).

## CSS
- All design tokens in `src/styles/global.css` (single file, no imports).
- Component-scoped CSS files exist (e.g. `src/components/Header/Header.css`) but are not included — they depend on app markup and aren't useful standalone.
- `cssEntry: .design-sync/styles-with-fonts.css` → imports Google Fonts + global.css.

## Components excluded
All page-section components are excluded (`componentSrcMap` null entries). These are:
Header, Hero, Footer, Calendar, Contact, EventModal, Events, EventCard, Lessons,
ScrollToTop, WorkInProgress, Instructor, MainLayout, and all page components.
Reason: each depends on React Router context, Supabase data hooks, or CityContext.
Floor-card authoring is possible on future re-syncs if any become useful.

## Re-sync risks
- `global.css` is the single source of truth for tokens; changes there are picked up automatically on re-sync.
- Google Fonts URL is hardcoded in `styles-with-fonts.css` — update it if font weights/families change.
- Component exclusion list may need updating if new PascalCase exports are added to src/.
- No authored previews — everything is floor cards. A future re-sync could author previews for any components that gain standalone composability.
