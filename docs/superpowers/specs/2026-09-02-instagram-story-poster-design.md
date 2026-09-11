# Instagram Story poster design

## Goal

Every event with a flyer shares an Instagram-ready 1080×1920 Story PNG containing that flyer. A blocked remote image must never silently produce a text-only poster. The poster must preserve the flyer at its natural aspect ratio and keep event details in Instagram's safe area.

## Root cause

`EventModal` passes `event.imageUrl` to `resolvePosterImage`. That browser-side CORS fetch returns `null` for hosts that do not grant cross-origin access. `ShareableEventPoster` then omits its image element, leaving only the gradient background. The event mapping itself preserves the stored `image_url`, so the failure is at remote-image acquisition rather than event data.

## Architecture

### Poster asset cache

Add a nullable `events.poster_image_url` column. It points to a public, normalized copy stored in the existing `event-flyers` bucket at `poster-cache/<event-id>/<source-hash>.<extension>`. It never replaces `events.image_url`, which remains the original flyer source.

Create `resolve-poster-flyer`, a Supabase Edge Function called by the public sharing flow with an event ID only. The function:

1. Loads the event and its stored source URL; callers never provide a fetch URL.
2. Returns `poster_image_url` when it already exists.
3. Validates uncached sources: HTTPS only, no credentials, no localhost/literal IP host, image MIME type, finite declared or streamed size at most 8 MiB, and at most three redirects with the same validation at every hop.
4. Fetches the source server-side, stores the validated image in `event-flyers`, saves the public cache URL to `events.poster_image_url`, and returns it.
5. Returns a typed failure when the source cannot be normalized. A share request with an existing flyer stops and shows an actionable error; it must not invoke the native share sheet with a missing image. A genuinely flyer-less event still shares the designed no-flyer poster.

The function accepts the app's publishable Supabase credential, verifies that the requested event is public/approved before serving it, and is rate-limited by the platform/function boundary. The endpoint does not expose arbitrary URL fetching.

### Client capture path

`resolvePosterImage` first requests the normalized cache URL by event ID, then fetches that storage URL into a data URL before `html-to-image` capture. This retains the existing capture invariant: the renderer receives only inline image data and never performs a cross-origin fetch itself. Native file sharing and direct-download fallback remain unchanged.

### Story layout

The 1080×1920 poster has three layers:

- A full-bleed, subdued cover copy of the flyer to remove empty space for portrait, square, and landscape assets.
- A framed foreground flyer in the upper content region, using `object-fit: contain` so artwork is never cropped. The frame occupies the visual focal area rather than serving as a faint background.
- A solid lower information panel inside Story safe areas: type, date, title, time, venue, price, and Salsa Segura call to action.

Without a flyer, the existing branded gradient remains, but the lower information panel and spacing stay identical. No text or buttons are added to the generated Story image.

## Data and security

- The original external URL remains immutable in `events.image_url`.
- Only the function's server credential writes cache objects and `poster_image_url`.
- Cache objects are public only because the approved event image is already public.
- Existing events are normalized lazily on their first share; no destructive bulk migration is required.
- A changed source URL yields a different hash and a new cache object. Replacing an event flyer clears `poster_image_url` in the same event update.

## Tests and verification

- Regression: a browser-CORS-blocked remote flyer resolves through the server cache and reaches the poster as a data URL.
- Regression: cache-normalization failure blocks native sharing when the event has a flyer and exposes an error.
- Regression: flyer-less events retain native sharing with the branded no-flyer poster.
- Component tests assert foreground flyer, background fill, safe information panel, and uncropped foreground image classes.
- Function tests cover cache hit, rejected source URLs, redirect validation, MIME/size rejection, successful cache write, and public-event authorization.
- Browser verification captures portrait, square, and landscape flyers at 1080×1920, then exercises the native share payload path.
