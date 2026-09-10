# Event Title Image Fallback — Design

## Context

Events without a flyer currently render inconsistently: only `EventModal` owns a narrow image resolver, while cards, detail views, organizer/admin previews, and share rendering do not share a visual fallback. Missing or broken event images must instead show recognizable SalsaSegura art that communicates the event itself.

## Grounded state of the codebase

| Area | Current state | Design consequence |
| --- | --- | --- |
| Event data | `DatabaseEvent.image_url` is nullable; title, type, date, city, and stable ID already exist | The fallback can be derived entirely in the client. |
| Modal imagery | `src/components/EventModal/eventModalImage.ts` exposes `resolveEventModalImage` with three callers | Replace its modal-specific fallback logic with the shared resolver. |
| Event representations | `DatabaseEvent` and `ScheduleXEvent` both carry title, type, date, city, and image URL information | Define one small view-model adapter instead of duplicating per-surface logic. |
| Styling | Event types are `social`, `class`, and `workshop`; public UI uses Ritmo Vivo tokens | Use type-led palettes compatible with existing tokens. |
| Share imagery | Existing share/poster rendering requires an image-like source | The fallback must be SVG/data-URL based, not CSS-only DOM. |

## Architecture decision

Create a deterministic, pure SVG generator and one resolver.

| Choice | Reason | Ripple |
| --- | --- | --- |
| Generate SVG/data URLs in the browser | No network, Storage objects, cache lifecycle, migration, or derived-data drift | All consumers can use a normal `<img src>`. |
| Seed motif selection with event ID | The same event has the same art on every surface and render | Visual stability for cards, modal, detail, and share generation. |
| Resolve at the rendering boundary | Real flyers always win; fallback stays presentation-only | No mutation of `events.image_url` or submission data. |
| One shared event-image contract | Avoids diverging fallbacks per surface | Existing modal resolver becomes a consumer of the shared contract. |

## Deliverables

### 1. Shared event title-art generator

A pure utility accepts:

- Stable event ID
- Event title
- `social`, `class`, or `workshop` type
- City
- Display date/time

It returns:

- A deterministic SVG data URL sized for the target image container
- Accessible fallback alt text, e.g. `SalsaSegura event title image for Havana Nights Social`

The composition contains:

- SalsaSegura logo lockup in the upper band
- Prominent event title
- City and formatted date below the title
- A type-specific palette: social = deep plum/coral; class = indigo/periwinkle; workshop = gold/warm red
- Exactly one subdued, seeded salsa motif: dancing couple, conga/bongo, claves, trumpet, or vinyl

The motif is decorative. Text remains in a contrast-safe panel/safe zone. Long titles are line-wrapped and clamped before SVG generation so text never overlaps the logo, metadata, or image edges.

### 2. Shared image resolver

A shared resolver takes the event image URL and title-art inputs.

- A non-empty flyer URL is returned initially.
- Missing or blank URLs return generated title art immediately.
- `<img>` load errors swap that exact image instance to generated title art.
- Generated title art is never uploaded, persisted, or written back to Supabase.

### 3. Universal adoption

Use the resolver in every event-image consumer:

- Public event cards and feed/list surfaces
- Calendar-related views where an event image is rendered
- `EventModal` header
- Full public event page hero
- Organizer and admin event previews
- Share/poster generation

The existing flyer remains unchanged whenever it loads successfully. Any surface that does not presently render an event image is outside this feature; the requirement applies wherever an event image is already rendered or generated.

### 4. Error handling and accessibility

- Decorative motif markup is excluded from SVG accessibility semantics.
- Generated image alt text names the event; flyer alt text keeps the existing event-specific convention.
- Image-load fallback must prevent an infinite `onError` loop by clearing/replacing the failing source once.
- Invalid or partial event inputs degrade safely: a neutral title, `Event`, and stable type fallback are used rather than throwing.

### 5. Tests

Test observable contracts:

- Identical inputs produce identical SVG URLs; changing event ID can change motif deterministically.
- Each event type applies the intended palette.
- Long and missing titles remain bounded and legible.
- Blank `image_url` renders title art.
- A failed flyer image changes to title art once.
- Flyer URLs continue to render unchanged when loaded.
- At least the modal and one card/share consumer use the shared resolver rather than bespoke fallback behavior.

## Wireframes

```text
┌──────────────────────────────────────────┐
│ SALSASEGURA                         ◌     │
│                                          │
│  HAVANA NIGHTS                         ♫ │
│  SOCIAL                                   │
│                                          │
│  Boston · Fri, Sep 4                      │
└──────────────────────────────────────────┘

Social: deep plum/coral · one low-opacity dance/music motif
Class:  indigo/periwinkle · one low-opacity dance/music motif
Workshop: gold/warm red · one low-opacity dance/music motif
```

## What this phase does not decide

- Flyer extraction or automatic event-data extraction
- New event-image storage, a database migration, or asset uploads
- New event detail routes, event schema changes, or SEO metadata policy
- A user-selectable visual theme for generated title art
- Image fallbacks for non-event entities such as hosts, venues, or galleries
