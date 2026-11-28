# VenueMapCard

"Where" card for a location: a stylized map preview, the venue name and address,
then "Venue page" and "Get directions" actions.

- Canonical source: `src/features/events/components/VenueMapCard.tsx` (+ `.css`, `.test.tsx`)
- Snapshot date: 2026-11-27
- Dependencies: `react-router-dom` (`Link`), `lucide-react` (`MapPin`, `ArrowRight`)

## Where it is used

| Surface | File | Venue source |
|---------|------|--------------|
| Event detail sidebar | `src/pages/EventDetailPage.tsx` | `events.location` / `events.address` |
| School profile | `src/features/entities/components/SchoolProfile.tsx` | the school's own name and address |

DJ and instructor profiles do **not** render this card. They have no single address:
they list venues and residencies as rows (`PlaceRow` in `DjProfile.tsx`) and show a
plain `where` line in `ProfileShell`. Add the card to another profile only when that
entity has one fixed street address.

## Props

| Prop | Type | Notes |
|------|------|-------|
| `venueName` | `string \| null` | Canonical venue name. |
| `streetAddress` | `string \| null` | Free-text street address. |
| `cityLabel` | `string \| null` | Display city. Hidden when the address already contains it. |
| `directionsHref` | `string \| null` | Maps deep link. `null` hides "Get directions". |
| `venuePageHref` | `string \| null` (optional) | Public venue route. Links the name and shows "Venue page". |
| `cityPageHref` | `string \| null` (optional) | Public city route. Links the city line. |

The card renders nothing when both `venueName` and `streetAddress` are empty.

## Call-site examples

Event detail: directions come from `mapsUrl()` in `src/utils/ics.ts`; entity links
come from reviewed entities.

```tsx
<VenueMapCard
  venueName={event.location}
  streetAddress={event.address}
  cityLabel={metroName(event.city)}
  directionsHref={mapsUrl(scheduleEvent)}
  venuePageHref={event.public_entities?.venue ? entityHref(event.public_entities.venue) : undefined}
  cityPageHref={event.public_entities?.city ? entityHref(event.public_entities.city) : undefined}
/>
```

School profile: the school is its own venue, so there is no venue page link.
Directions use a Google Maps search URL built from name plus address.

```tsx
const town = [school.city, school.state_region].filter(Boolean).join(", ");
const addressQuery = [school.address, town].filter(Boolean).join(", ");
const directions = addressQuery
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${school.name}, ${addressQuery}`)}`
  : null;

<VenueMapCard
  venueName={school.name}
  streetAddress={school.address ?? null}
  cityLabel={town || null}
  directionsHref={directions}
/>
```

## Design rules

- **No live map.** The preview is drawn from tokens (rose glow, faint grid, red pin)
  because no map-tile API is configured. The "Map preview" caption keeps it honest:
  never imply live map data.
- **No invented data.** The city line is added only when the address lacks it; empty
  fields are omitted, never filled with placeholders.
- **One `<h2>` labelled "Where"** names the region (`aria-labelledby="venue-card-label"`).
  Only one card per page: the id is fixed.
- External directions open in a new tab with `rel="noopener noreferrer"`.
- Actions are 44px-tall touch targets with a visible gold focus ring.
- Preview height is 148px, 128px below 640px.

## Tests

`VenueMapCard.test.tsx` pins the contract: preview above the fields, safe external
directions, conditional CTAs, and no repeated city. Run it at the canonical source:

```bash
npx vitest run src/features/events/components/VenueMapCard.test.tsx
```
