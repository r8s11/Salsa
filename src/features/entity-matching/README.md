# Phase 4 — Entity Matching + Taxonomy Reconciliation

## What changed

Phase 4 reconciles AI-extracted flyer text against existing SalsaSegura canonical
data (venues, organizers, dance-style + event-type taxonomy) using **deterministic,
candidate-set matching** that runs **server-side** so admin-only RLS on `venues` /
`organizers` is never weakened for the browser.

## New Edge Function: `reconcile-flyer`

- File: `supabase/functions/reconcile-flyer/index.ts` (+ `matching.ts`, `extractionTypes.ts`)
- Purpose: read `venues` / `organizers` / `taxonomy_terms` with the **service role**,
  return a structured reconciliation (`exact | strong | ambiguous | none`).
- Auth: requires a valid caller JWT (anon cannot spend the read budget).
- Writes nothing; never creates entities; never fabricates ids.
- On any error it returns a benign "no match" result so the manual submit flow is
  never blocked.

### Deploy (manual — no auto-migration)

```bash
supabase functions deploy reconcile-flyer
```

It reads `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from the
project's edge-function secrets (already present in other functions). No SQL migration
is required: the matcher uses existing columns (`normalized_name`, `slug`, `instagram`,
`website`, `city`, `status`) and the `taxonomy_terms` / `events.venue_id` schema that
already exist.

## Matching rules (see src/features/entity-matching)

- **Venue**
  - `exact`   : normalized name + normalized address both match
  - `strong`  : normalized name + city match, exactly one candidate
  - `ambiguous`: name matches but multiple candidates (or no corroborating context)
  - `none`    : no reliable candidate
  - No Levenshtein / phonetic matching — "Havana Club" never becomes "Havana Nights"
    or "Club Havana".
- **Organizer** (the `organizers` brand table, NOT a user account)
  - `strong` on exact Instagram handle, exact website domain, or single exact name
  - `ambiguous` on a duplicated brand name; `none` otherwise
  - An `organizer_id` is returned only on `strong`; a `user_id` is **never** produced.
- **Taxonomy** — explicit alias maps (`DANCE_STYLE_ALIASES`, `EVENT_TYPE_ALIASES`).
  Specificity is preserved (`Bachata Sensual` → slug `bachata`, raw text kept).
  Unsupported types (`festival`) stay unresolved.

## Apply behavior (Phase 3 safe-merge preserved)

- Resolved canonical venue → fills **empty** address/city only; user values win.
- Resolved organizer brand name → used in the description "Presented by" line.
- Ambiguous / unresolved matches are never applied automatically.
- The submit pipeline does not yet persist `venue_id` / `organizer_id` (the submit
  `EventForm` capability is `venue: "free-text"`, `hostAndContact: false`), so
  resolved entities currently inform the form's free-text fields. Persisting
  `venue_id` into submissions is a separate, later change.

## Tests

- `src/features/entity-matching/entityMatching.test.ts` — 30 focused matcher tests.
- `src/features/flyer-extraction/applyExtraction.test.ts` — Phase 4 apply-merge tests.
- `src/pages/SubmitEventPage.flyer.test.tsx` — Phase 4 user-value-wins tests.
- Full suite: 956 passing. `npm run lint` clean, `npm run build` succeeds.
