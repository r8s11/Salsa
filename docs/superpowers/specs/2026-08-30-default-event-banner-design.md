# Default event banner

## Context
Events without an uploaded flyer currently receive generated SVG artwork selected from event metadata. The product now provides `design/Banner.png` as the canonical default image.

## Grounded state of the codebase

| Surface | Current no-flyer behavior | Required behavior |
| --- | --- | --- |
| EventCard / FeaturedEventCard | `SalsaSeguraFallbackImage` SVG template | Shared static banner |
| EventModal | `SalsaSeguraFallbackImage` SVG template | Shared static banner |
| EventDetailPage | `SalsaSeguraFallbackImage` SVG template | Shared static banner |
| Admin event table | `SalsaSeguraFallbackImage` SVG template | Shared static banner |

## Architecture decision

Copy `design/Banner.png` to `public/images/default-event-banner.png`. Treat that public URL as the sole no-flyer image source.

Image precedence is strict:

1. Event-specific uploaded flyer (`image_url` / `imageUrl`)
2. `/images/default-event-banner.png`

The prior generated-template component and selection utility are removed rather than retained as a hidden fallback path. This keeps the new default consistent across all surfaces and eliminates unused artwork-selection behavior.

## Implementation

- Add a small shared fallback-image constant/helper that returns the public banner URL when no flyer is available.
- Update card, featured-card, modal, detail-page, and admin-thumbnail rendering to use that URL while preserving existing flyer behavior.
- Preserve `object-fit: cover` and each surface's established dimensions.
- Mark adjacent-image use as decorative (`alt=""`) where the event title is already exposed by the surrounding card, modal, or page.
- Remove the SVG artwork component, styles, template-selection utility, and their tests.

## Verification

- Tests prove uploaded flyer precedence and the banner fallback URL.
- Tests cover the affected rendering surfaces.
- Run targeted Vitest tests, TypeScript checking, lint, production build, and browser checks at desktop and mobile viewport widths.

## Boundaries

This change does not add new database fields, image upload behavior, responsive image pipelines, image transformation, or an additional fallback after a browser-level image-load failure.
