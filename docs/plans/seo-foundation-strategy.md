# SalsaSegura — Foundational SEO & Information Architecture Strategy

**Status:** Strategy / architecture document. No code changed by this document.
**Author context:** Senior Technical SEO Strategist review, grounded against the actual SalsaSegura codebase as of 2026-08-12.

---

## 0. Grounding: what actually exists today

Before any recommendation, here is what the repo currently contains — several assumptions in the request brief do not hold, and the plan below is built on the real state, not the assumed one.

| Area | Current reality |
|---|---|
| Rendering | Pure client-side SPA. Vite + React 19 + `react-router-dom` v7 in classic `<Routes>/<Route>` mode (not v7 "framework"/data mode). Azure Static Web Apps hosting with `navigationFallback` rewriting **every** unmatched path to `/index.html` (`staticwebapp.config.json:2-5`). There is no server, no SSR, no build-time prerendering. |
| Metadata | **One** static `<head>` block in `index.html` (title, description, OG, Twitter, two JSON-LD blocks). Identical on every route — `/`, `/calendar`, `/about`, `/admin/*` all serve the same `<title>` and `og:image`. No `react-helmet-async` or any per-route head management exists in `package.json`. |
| Event pages | **There is no public `/events/:slug` route today.** `src/pages/CalendarPage.tsx` is 4 lines rendering a single `<Calendar />` component built on `@schedule-x/calendar` — a JS calendar widget. Events are fetched client-side and rendered into a calendar grid/modal; no event has its own crawlable URL, canonical, or structured data today. This is the single biggest gap and the main reason this phase exists. |
| Venues / Organizers | **No `venues` table. No `organizers` table.** `events.location` and `events.address` are free-text columns; `events.host` is a free-text column (`src/features/events/model/types.ts:12-13,28`). The brief's assumption that these are already normalized models is incorrect — `/venues/:slug` and `/organizers/:slug` require new tables, not just added SEO columns. |
| Events schema | `events` (baseline `20260101000000_baseline_events_schema.sql`, extended through `20260814000000_events_management_fields.sql`) has: `id, title, description, event_type, event_date, event_time, location, address, price_type, price_amount, rsvp_link, image_url, submitter_*, status, source_type, dance_styles text[], city, host, recurrence, gallery text[], contact_*`. No `slug`, no `published_at`, no `latitude/longitude`, no `timezone`, no `seo_title`/`seo_description`. `status` already models `draft/pending/approved/rejected/cancelled/archived` — a real asset for Section 7/10/31 below. |
| City model | `City = "boston" | "new-york-city"` (`src/contexts/CityContext.tsx`), a closed 2-value union today — not an open geographic table. |
| Sitemap / robots | `public/sitemap.xml` and `public/robots.txt` exist but are **static, hand-written, and already wrong**: `sitemap.xml` references `/Lessons` and `/Instructors` (capitalized) while the actual routes are lowercase `lessons`/`instructors` (`src/App.tsx:78-79`) — a live case-mismatch bug. The `Disallow: /admin/` line in `robots.txt` is commented out — `/admin/*` is currently crawlable by robots.txt (it is protected only by client-side auth via `RequireAdmin`, which does not stop indexing, see §2/§19). Neither file is regenerated at build time. |
| Deploy | GitHub Actions → `npm ci && npm run lint && npx vitest run` → `npm run build` (Vite, outputs `dist/`) → Azure Static Web Apps upload. Pure static file hosting; no Node runtime for the app itself. |

Everything below is designed against this reality: a static-hosted CSR SPA with a normalized `events` table but no venues/organizers/slugs/per-route metadata yet.

---

## 1. Foundational SEO strategy

The platform's organic-search asset is **events** — thousands of individually searchable, locally-relevant, time-bound pages. Right now that asset is invisible to search engines (client-rendered calendar widget, no unique URLs). The foundation has three legs, in dependency order:

1. **Make events individually addressable and crawlable.** A stable `/events/:slug` URL, server-visible content, and per-page metadata are prerequisite to everything else in this brief (structured data, sitemaps, social sharing, city/venue/organizer pages all reference or depend on the event page existing).
2. **Normalize the entities events already imply** (venue, organizer, city) so their pages aren't guesswork later. This is a schema change, not an SEO change — but it is the schema change that makes venue/organizer/city SEO possible without a rebuild in six months.
3. **Wrap it in the crawl/index mechanics**: robots, sitemap, canonical, structured data, metadata templates — all of which are cheap once (1) and (2) exist, and are premature/wrong to build before they exist.

Everything else (recurring-event dedup, programmatic city×style pages, monitoring) is refinement on top of that foundation and is explicitly sequenced into "Later Growth" in §33.

---

## 2. Critical SEO risks with the current React/Vite architecture

| Risk | Why it matters | Severity |
|---|---|---|
| No event has a crawlable, unique URL | Google cannot index what has no URL. The entire event catalog — the product's core content — is currently invisible to search. | Critical |
| Single static `<head>` for all routes | Every indexed page (once they exist) would share one title/description/OG image unless per-route metadata is added. Duplicate `<title>`/`<meta description>` across pages is a well-documented ranking and CTR suppressor. | Critical |
| Pure CSR with no prerendering | Googlebot does render JS (via a headless Chromium pass), but: (a) it queues render as a second pass, sometimes days after crawl, delaying indexing; (b) Bing, and many non-Google crawlers/scrapers/link-preview bots (WhatsApp, iMessage, Slack, Facebook), do **not** reliably execute JS at all — they need real HTML in the initial response for social-preview cards (§21) to work. This directly affects the "share a flyer to WhatsApp" use case named in the brief. | High |
| `robots.txt` doesn't actually block `/admin/` | The Disallow line is commented out. `/admin/*` relies solely on `RequireAdmin` client-side auth, which returns a sign-in redirect but still serves a 200 HTML shell to crawlers — admin routes are currently crawlable in principle (low practical risk since there's no content behind the auth wall for a bot, but it's an unintentional gap, not a decision). | Medium |
| Hand-maintained, already-stale sitemap | `/Lessons` / `/Instructors` casing mismatch means those sitemap entries 404 or redirect today. A hand-maintained sitemap cannot scale to hundreds of events and will silently drift further. | Medium |
| No canonical mechanism beyond the homepage | Only `/` has a `<link rel="canonical">` (hardcoded in `index.html`). No page-level canonical exists once other routes get real content. | Medium (High once event/filter pages exist) |

---

## 3. Rendering / indexability recommendation

**The Admin Dashboard needs zero SEO work — it must stay exactly as it is (CSR, auth-gated, no metadata investment).** This recommendation is scoped entirely to the public surface: `/`, `/events/*`, `/cities/*`, `/venues/*`, `/organizers/*`, `/dance-styles/*`, `/calendar`, `/about`, `/contact`.

### Recommendation: build-time prerendering, not full SSR

Full SSR (Next.js/Remix-style, or migrating `react-router-dom` v7 to its "framework" data-router mode with a Node server) would require a real application server — Azure Static Web Apps in its current configuration is pure static hosting (`app_location: "/"`, `output_location: "dist"`, no `api_location`). Adding SSR means either standing up an Azure Functions-backed SSR pipeline or moving off Static Web Apps entirely — that **is** the rebuild this brief explicitly wants to avoid, and it is not justified by current traffic/inventory.

**Prerendering achieves the same crawl/social-preview outcome without it.** At build time (or on a scheduled/triggered rebuild), generate static HTML files for every known public URL — each event, venue, organizer, city, dance-style page — with the correct `<title>`, `<meta description>`, canonical, Open Graph tags, and JSON-LD already baked into the HTML `<head>`/`<body>`, then hydrate into the same React app on load exactly as today. Azure Static Web Apps serves static files natively; this changes nothing about hosting, deploy pipeline, or the client app's runtime behavior — it only changes what `npm run build` emits.

Concretely: a Node script (run as `npm run build && npm run prerender`, or folded into a Vite plugin) queries Supabase for all published events/venues/organizers/cities, renders each route's `<head>` (and ideally a server-renderable content shell via `react-dom/server`'s `renderToStaticMarkup` for the above-the-fold event summary) into a static `.html` file at the matching path in `dist/`, alongside the sitemap generation described in §19. Static Web Apps' `navigationFallback` already only applies to *unmatched* paths (`staticwebapp.config.json:2-5`), so prerendered files at exact paths win automatically — no routing change needed.

### Categorized recommendations

**Required Before Launch:**
- Per-route `<head>` management on the client (react-helmet-async or React 19's native `<title>`/`<meta>` hoisting — React 19 supports rendering `<title>`, `<meta>`, `<link>` directly in component trees and React hoists them into `<head>` automatically, no extra dependency needed). This fixes duplicate metadata even before prerendering exists, and is required regardless of the prerendering decision.
- The `/events/:slug` route itself, with server-visible-equivalent content once prerendered.
- `robots.txt` actually disallowing `/admin/`, `/account/`, `/auth/` (§19).
- Canonical tag support per route (§17).

**Recommended Soon (first 30 days post-launch of event pages):**
- Build-time prerendering for event, venue, organizer, city, dance-style pages (the mechanism above).
- Dynamic sitemap generation replacing the static file (§19).
- Social-preview validation (Facebook Sharing Debugger, Twitter Card Validator) against the prerendered output, since these tools do not execute JS and will otherwise show stale/generic previews (§21).

**Future Optimization:**
- True SSR / migrating to React Router v7 framework mode (or a meta-framework) — only justified once event inventory and traffic volume make prerender build times or content freshness (events change status right up to start time; a purely build-time-prerendered page could show stale status for hours) a real problem. At that point, incremental/on-demand prerendering (regenerate a single event's static file on status change via a Supabase webhook → small Azure Function → write to blob storage in front of SWA, or a scheduled rebuild every N minutes) is the next step before jumping to full SSR.
- Edge-side rendering / ISR-style patterns if Azure SWA's plan tier is upgraded.

---

## 4. Public vs. private indexing

| Path | Recommendation | Mechanism |
|---|---|---|
| `/` | index | — |
| `/calendar` | index (canonical calendar/discovery view) | canonical to self, no query params indexed |
| `/events/:slug` | index | core content type |
| `/cities/:city` | index once it meets the content threshold (§9) | conditional `noindex` below threshold |
| `/venues/:slug` | index once venue has ≥1 upcoming or recent event and an address (§12) | conditional `noindex` |
| `/organizers/:slug` | index once organizer has ≥1 published event and a description (§13) | conditional `noindex` |
| `/dance-styles/:style` | index once style has enough events in enough cities to be non-thin (§10) | conditional `noindex` |
| `/about`, `/contact` | index | — |
| `/lessons`, `/instructors`, `/schools` | index (existing content) | — |
| `/submit` (event submission form) | **noindex, follow** | it's a form/tool, not search-intent content; keep crawlable for link equity to flow through but not eligible for ranking |
| `/profile`, `/profile/edit/:eventId` | **noindex** + block via `robots.txt` (`/profile/`, private user data) | robots.txt + noindex belt-and-suspenders (see §19 for why both) |
| `/signin`, future `/signup`, `/reset-password` | **noindex**, allow crawl (don't `robots.txt`-block auth pages — Google needs to see they're login walls, and blocking can look adversarial to some crawlers) | `<meta name="robots" content="noindex,follow">` |
| `/admin/*` | **noindex** + `robots.txt` Disallow | both — see §19's explanation of why admin gets the belt-and-suspenders treatment while `/submit` doesn't |
| Search/filter result URLs (`?city=...&style=...`) | **noindex** the parameterized variant; canonical → the clean unfiltered/category URL | see §16/§17 |
| Future public user profiles | **noindex at launch** (§14) | revisit once profiles have genuine public content |
| Future RSVP lists | **noindex always** — this is a privacy surface, not a content surface (who's attending is not something to expose to search engines regardless of page maturity) | noindex + never listed in sitemap |

### robots.txt vs. noindex vs. canonical — when each applies

- **`robots.txt` (Disallow)** stops crawling — the bot never requests the page. Use it for pages with **no SEO value and no reason for a bot to spend crawl budget there**: admin, account settings, auth flows' non-HTML assets. Caveat: Disallow does not guarantee a URL stays out of the index — if other pages link to a disallowed URL, Google can still index the *URL* (with no snippet, "no information is available") from external signals alone. It is a crawl-budget tool, not an index-removal tool.
- **`noindex`** (meta tag or `X-Robots-Tag` header) stops indexing but **requires the page to be crawled** so the bot can see the tag — so never combine `Disallow` + `noindex` on the same URL (the bot never gets far enough to see the noindex, and the URL can still surface bare in results, which is the *opposite* of the intended outcome). Use `noindex` for pages that should exist and be crawlable (for link equity / discovery of other pages they link to) but shouldn't rank themselves: `/submit`, `/signin`, thin/below-threshold city or venue pages, filter-parameter URLs.
- **`canonical`** doesn't block crawling or indexing — it tells the engine "if you're going to index something here, attribute it to this other URL instead." Use it for **legitimate duplicate/near-duplicate content that must remain reachable**: a filtered view of `/calendar`, a recurring event occurrence pointing at its series page, tracking-parameter URLs (`?utm_source=...`).

Rule of thumb applied throughout this doc: **block with robots.txt only what should never be crawled at all (admin); noindex what should be crawled but not ranked (forms, auth, thin pages); canonicalize what's a legitimate variant of something else (filters, recurrences, tracking params).**

---

## 5. Final URL architecture

```
/
/calendar                              (discovery / all-events view, existing)
/events
/events/:event-slug
/cities
/cities/:city-slug
/cities/:city-slug/:dance-style-slug   (future — see §11, gated)
/venues
/venues/:venue-slug
/organizers
/organizers/:organizer-slug
/dance-styles
/dance-styles/:style-slug
/about
/contact
/lessons
/instructors
/schools
/submit                                (noindex)
```

### City-in-URL decision: `/events/:slug`, **not** `/events/:city/:slug`

Recommend the flat `/events/:event-slug` form. Reasoning against the brief's alternative (`/events/boston/salsa-at-the-anchor`):

- **Stability.** Event city is metadata about the event, not an immutable property of its identity. A recurring series can move venues across town lines (e.g., "Salsa Mondays" moving from a Boston venue to a Cambridge one) without needing a redirect if the city isn't load-bearing in the URL. The brief's own stated goal ("URLs should remain stable even if event details change") argues directly against embedding city.
- **City is already a first-class filter/browse dimension** via `/cities/:city-slug`, which lists that city's events — the discovery path "browse by city → find event" doesn't need the city repeated inside the event's own permanent address.
- **Simplicity for a 2-city platform today.** With `city ∈ {boston, new-york-city}`, nesting doesn't currently disambiguate anything meaningful slug-wise (event slugs are already unique platform-wide, see §6).
- Internal linking (§15) still gets Boston→event and event→Boston association via `<a>` links and breadcrumbs (`Cities / Boston / Salsa at the Anchor`) without it being baked into the URL string — breadcrumbs carry that context for both users and `BreadcrumbList` structured data (§6/§15) without a URL-stability cost.

If SalsaSegura expands to many cities and slug collisions across cities become common (two different cities both getting a "Salsa Mondays" submission), resolve via the slug-uniqueness strategy in §6 (append a disambiguator), not via city-prefixed URLs.

---

## 6. Slug strategy

**Slugs are generated once at creation and are immutable identifiers, decoupled from the display title.** Editing an event's title never changes its slug. This is the load-bearing decision that makes every other stability guarantee in this doc possible.

### Events

- Slug = kebab-case of the title at submission time, **not date-suffixed**: `salsa-mondays-havana-club`, not `salsa-mondays-august-17-2026`. The brief's own comparison is correct to reject the date-suffixed form — a dated slug forces a *new* URL for every single occurrence of a recurring event, which is exactly the duplicate-content problem §8/§9 exist to prevent, and it makes the URL wrong the moment the event reschedules.
- Collision handling: if `slug` already exists, append a short, stable disambiguator derived from the venue or a short random suffix — `salsa-mondays-havana-club`, and a second unrelated "Salsa Mondays" elsewhere becomes `salsa-mondays-metromovers` (venue-derived, still human-readable) rather than `salsa-mondays-2` (meaningless, and collides again if a third is created then the second is deleted). Fall back to a 4-character random suffix only if venue-derived disambiguation also collides.
- Recurring series: the **series** gets one evergreen slug (`salsa-mondays-havana-club`); see §8/§9 for whether individual occurrences get their own URLs at all.
- Renames: title changes never touch the slug. If an admin explicitly needs a new slug (rare — e.g., correcting a typo'd venue in the slug itself), the redirect table (§29) captures old→new so any indexed/shared/bookmarked link 301s forward instead of 404ing.

### Venues

- Slug = venue name, kebab-case: `havana-club-cambridge`. Include city/disambiguator in the slug itself (not the URL path) when venue names collide across cities, since venues (unlike events) genuinely are anchored to one physical location for their lifetime — `dance-union` vs `dance-union-somerville` if two venues share a brand name.

### Organizers

- Slug = organizer brand name, kebab-case: `sabor-latino-boston`. Organizer brand changes (rebrand) are rare but real — handle via the redirect table exactly like event renames.

### Cities

- Slug = URL-safe city identifier, matching the existing `City` union values' intent: `boston`, `new-york-city`. (Note: standardize on `new-york-city` not `new-york` — the current `City` type already uses `new-york-city`; keep the type and the slug identical to avoid a translation layer.)

---

## 7. Event-page SEO specification

**Route:** `/events/:slug`

### Fields required to render the page and its metadata (mapped to schema, see §28 for what's new)

| Concept | Source today | Gap |
|---|---|---|
| Event name | `events.title` | none |
| Description | `events.description` | none |
| Date/start time | `events.event_date` + `events.event_time` | no combined `timestamptz`, no `timezone` column (§27) |
| End time | — | **missing entirely** — needed for `Event.endDate` (§6/structured data) |
| Venue | `events.location` (free text) | not a normalized entity (§12/§27) |
| City/state | `events.city` (enum), no state | no `state`/`postal_code` (§27) |
| Organizer | `events.host` (free text) | not a normalized entity (§13/§27) |
| Dance styles | `events.dance_styles text[]` | none |
| Price | `events.price_type`, `events.price_amount` | none |
| Image | `events.image_url`, `events.gallery` | none |
| Status | `events.status` | none — already models cancelled/archived, a real asset |

### Automatic metadata template (no manual entry required for the common case)

```
Title:        {title} — {primary_dance_style} in {city_display_name} | SalsaSegura
              (truncate title if combined length > ~60 chars; drop dance_style
               clause first, then city clause, keeping title + brand as the floor)
Description:  {title} on {formatted_date} at {venue_name_or_location}, {city_display_name}.
              {price_clause} {first_140_chars_of_description}
              (price_clause: "Free entry." | "Tickets from $X." | "")
Canonical:    https://salsasegura.com/events/{slug}
OG title:     same as Title, without the "| SalsaSegura" suffix (redundant once
              og:site_name is set)
OG image:     events.image_url, falling back to a branded default flyer (§21)
OG type:      "event" is not a real OG type; use "website" per OG spec, carry
              event semantics via JSON-LD instead
```

This template needs zero admin input for a normal event. **Manual override fields** (`seo_title`, `seo_description` — see §27) exist for the exceptional case (a flagship event worth hand-tuned copy) and are optional, never required.

### Example, worked

> `Salsa at the Anchor — Salsa Dancing in Boston | SalsaSegura`
> *(matches the brief's own example exactly — confirms the template above produces it)*

---

## 8. Structured data strategy

JSON-LD, injected per-page (not just the two static blocks currently hardcoded into `index.html`, which should remain but stay homepage-scoped).

### `Event` (on `/events/:slug`)

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "…events.title…",
  "description": "…events.description…",
  "image": ["…events.image_url, gallery[0..]…"],
  "startDate": "2026-08-17T20:00:00-04:00",
  "endDate": "2026-08-17T23:00:00-04:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "…venue name…",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "…",
      "addressLocality": "…city…",
      "addressRegion": "…state…",
      "postalCode": "…",
      "addressCountry": "US"
    }
  },
  "organizer": {
    "@type": "Organization",
    "name": "…host / organizer name…",
    "url": "https://salsasegura.com/organizers/…slug…"
  },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "url": "…events.rsvp_link or event page URL…"
  },
  "url": "https://salsasegura.com/events/…slug…"
}
```

**Lifecycle mapping (must match what's visibly rendered — see §7's rule against misleading markup):**

| `events.status` | `eventStatus` value | Page behavior |
|---|---|---|
| `approved`, future date | `EventScheduled` | normal |
| `cancelled` | `EventCancelled` | visible banner "This event has been cancelled" (§10) |
| rescheduled (no dedicated status today — modeled as a date change + admin note) | `EventRescheduled` + `previousStartDate` | visible banner naming the new date; **requires a `previous_start_date` capture at the moment of reschedule** — currently there's no mechanism to know an event *was* rescheduled vs. just created with this date (§27 gap) |
| `archived` / past `event_date` | `EventScheduled` (past events keep their original status type; schema.org doesn't have a "finished" status) | page still renders normally; §10/§31 govern indexability, not the schema type |

Omit `offers` entirely (not an empty/zero placeholder) when `price_type` is null and no RSVP link exists — an absent field is honest; a fabricated `"price": "0"` for genuinely-unknown pricing is exactly the "misleading markup" the brief warns against.

### `Organization` (site-wide, keep existing homepage block, refine site name and remove the `DanceSchool` type mismatch — see note below)

### `Place` (embedded in `Event.location`, and standalone on `/venues/:slug`)

### `BreadcrumbList` (every page below the homepage — see §15)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Cities", "item": ".../cities"},
    {"@type": "ListItem", "position": 2, "name": "Boston", "item": ".../cities/boston"},
    {"@type": "ListItem", "position": 3, "name": "Salsa at the Anchor"}
  ]
}
```

### `WebSite` (keep existing homepage block; the `SearchAction` target currently points at `/calendar?search={search_term_string}` — once `/events` exists as the canonical browse surface, verify this target still matches the actual in-app search UX before launch, don't let it silently drift)

### Existing homepage markup note (not part of this phase's build, flagged for correctness)

`index.html`'s current JSON-LD types the site as `DanceSchool` with a `hasOfferCatalog` of *lessons* (private lessons, pop-up classes) — that's accurate for the site's *class* offerings but says nothing about it being an **event discovery platform**, which is the product's actual and growing identity per this brief. Recommend adding a second, separate JSON-LD block of type `WebSite` (already present) is not enough — consider whether `Organization` (not `DanceSchool`) better represents the platform going forward, with `DanceSchool`-specific offer-catalog markup narrowed to wherever lesson/class content actually lives (`/lessons`, `/schools`). Out of scope to change today; noted so it isn't inherited uncritically once event pages ship.

**Types evaluated and rejected:** `SportsEvent`/`SocialEvent` subtypes (schema.org's plain `Event` + `eventAttendanceMode` is the correct, most broadly-supported choice — subtyping buys nothing here and risks parser mismatches). `AggregateOffer` (only relevant once multi-tier ticketing exists — not today). `Person` for organizers (organizers here are brands/collectives, not individuals — `Organization` is correct).

---

## 9. Recurring-event SEO strategy

**Recommendation: series page + occurrences, with the series as the canonical/indexable surface and individual occurrences as non-canonical variants of it — not separate indexable pages.**

Concretely: `salsa-mondays-havana-club` (§6) *is* the series page, at `/events/salsa-mondays-havana-club`. It:
- Always shows the **next upcoming occurrence's** date/time/status as the page's primary content and `Event.startDate`.
- Lists subsequent occurrences below the fold (a lightweight "Upcoming dates" section) so users seeking "next Monday" specifically can still confirm it.
- Uses schema.org's native recurrence support — `Event.eventSchedule` (a `Schedule` object with `repeatFrequency`/`byDay`) is the standards-correct way to express "every Monday" in one structured-data block, rather than emitting N separate `Event` nodes.

**Occurrences do not get their own crawlable/indexable URL.** If the product needs a way to link to "this specific Monday" (e.g., from an email or a calendar-add action), use a query parameter (`/events/salsa-mondays-havana-club?date=2026-08-17`) that is explicitly `canonical`'d back to the bare series URL — reachable, shareable, functional, but never an independent index entry. This directly satisfies the brief's stated worry ("hundreds of nearly identical pages") without sacrificing the "salsa dancing Monday Boston" / "Havana Club bachata Monday" search intent named in the brief — that intent is served by the series page itself (which *is* about "Mondays at Havana Club") plus the city page's day-of-week context (§9 continues into §11's city×style pattern), not by minting a page per date.

This requires `events.recurrence` (already exists as a text field) to become the actual grouping key rather than incidental metadata — recommend it become a structured `recurrence_rule` (RFC 5545 RRULE string or equivalent) plus a `series_id` linking occurrence rows to one series row, so "next occurrence" and "upcoming dates list" are queries, not manual admin upkeep (§27).

---

## 10. Cancelled / rescheduled / past-event strategy

**Never 404 or immediately delete an event that had a public URL.** A 404 discards accumulated backlinks, search visibility, and any bookmark/share link in circulation — for zero benefit, since the alternative costs nothing but a status check.

| Lifecycle state | HTTP status | Indexability | Structured data | Visible UI |
|---|---|---|---|---|
| Scheduled (future) | 200 | index | `EventScheduled` | normal |
| Cancelled | 200 | index (short-term), then noindex after ~30 days | `EventCancelled` | prominent banner: "This event has been cancelled." — content stays, banner replaces any RSVP/ticket CTA |
| Rescheduled | 200 | index — the page **is** the (moved) event, same URL | `EventRescheduled` + `previousStartDate` | banner: "This event has been rescheduled to {new date}." |
| Finished (past, non-recurring) | 200 | index for a grace window (~90 days — past events remain genuinely useful for organizer/venue history, recurring-series context, and "did this venue host X before" queries), then transition to §31's noindex-but-keep policy | `EventScheduled` with past `startDate` (schema.org has no "finished" state; the date itself communicates pastness) | banner: "This event has passed." Past events optionally surface "similar upcoming events at this venue" to route the residual traffic somewhere useful (a real internal-linking payoff, §15) |
| Archived (`events.status = 'archived'`) | 200 | noindex | omit `Event` JSON-LD entirely (it's no longer a live event listing) | "This event is archived" — still human-readable, not deleted |
| Deleted (hard delete, rare — e.g., spam/duplicate submission) | **410 Gone** (not 404) | excluded | none | — |

**410 vs. 404, explicitly:** 404 says "nothing is here, maybe check back" — search engines keep re-crawling to see if it returns. 410 says "this was deliberately and permanently removed" — engines de-index faster and stop re-checking, which is the correct signal for a genuinely deleted spam/duplicate event, and the *wrong* signal for anything that simply finished or got cancelled (those aren't gone, they're a past-tense version of a real thing — hence the 200-with-banner treatment above, not 410).

This requires no new schema beyond what §27 already proposes (`event_status` already has the needed states); it's a rendering-logic and indexability-policy decision, not a database one.

---

## 11. City landing pages

`/cities/:city-slug` must earn its indexability with real, current, useful content — never a templated paragraph with the city name swapped in.

**Required content before a city page indexes** (below this, the page still exists and functions for navigation but is `noindex`):
- ≥5 upcoming events in that city (arbitrary-but-reasonable floor; tune after launch data)
- At least 2 distinct venues represented

**Page content, all derived from real data (no hand-written per-city copy needed):**
- Upcoming events (paginated/filtered from the existing events data, grouped by week)
- Dance styles active in that city this month (derived from `dance_styles[]` across the city's events — doubles as internal links into `/dance-styles/:style`)
- Venues hosting events there (derived, links to `/venues/:slug`)
- Organizers active there (derived, links to `/organizers/:slug`)
- Optional, once volume supports it: "This weekend" / "Free events" / "Beginner-friendly" sub-sections — these are **filtered views of the same city page's data**, not separate URLs (see §16 on filter-URL discipline) unless one of them independently earns enough sustained search volume to justify its own indexable page later.

City page structured data: `CollectionPage` (or omit — a `BreadcrumbList` plus the embedded `Event` list's own per-event markup is sufficient; don't force an ill-fitting schema type onto an aggregator page).

---

## 12. Dance-style landing pages

`/dance-styles/:style-slug` — same non-thin-content discipline as city pages.

**Indexable once:** the style has events in at least one city meeting a minimum count (e.g., ≥3 upcoming), *and* there's a short (2-3 sentence), genuinely useful, hand-written context block per style (what salsa/bachata/kizomba *is*, one time, reused everywhere that style appears — not regenerated per city). This is the one place a small amount of editorial content is justified: it's evergreen, written once per style (a handful of styles, not hundreds), and directly serves the "what is X dance" query alongside "X events near me."

**Page content:** upcoming events across all cities for that style, grouped by city (internal links into `/cities/:city`), popular venues for that style, organizers who run that style's events, the style-context blurb.

---

## 13. City + dance-style combination pages

Recommend URL pattern **`/cities/:city-slug/:dance-style-slug`** (nested under city, not `/salsa/boston`) — consistent with the rest of the architecture (§5's flat-event, nested-browse pattern; dance-style already has its own top-level browse surface at `/dance-styles/:style-slug`, so `/cities/boston/salsa` reads as "Boston, filtered to salsa" which is exactly what it is, while `/salsa/boston` would need a second top-level namespace that doesn't otherwise exist).

**Indexability threshold — do not auto-generate all city×style combinations.** A combination page is only created (and only then indexed) when:
- The city independently meets §11's threshold, **and**
- The style has ≥3 upcoming events specifically in that city (not just platform-wide), **and**
- There is at least 1 unique venue for that combination (prevents a single recurring event from justifying an entire landing page)

Below threshold: the combination is served as a **filtered view of the city page** (`/cities/boston?style=salsa`, noindexed per §16) rather than a dead/thin dedicated URL. This is the concrete mechanism that prevents "generate `/salsa-in-every-city`" (§35) — the page simply doesn't get created (or gets created but stays noindex) until the underlying data justifies it, checked programmatically at build/generation time, not asserted by an editor.

---

## 14. Venue SEO

`/venues/:slug` — **requires the new `venues` table (§27); does not exist today.**

**Indexable once:** venue has an address **and** ≥1 upcoming or ≥1 event within the past 90 days (mirrors §10/§31's past-event window — a venue that hosted something last month is still a legitimate, useful page; a venue stub with zero event history is not).

**Content:** venue name, address (rendered + embedded map), upcoming SalsaSegura events there, recent past events, dance styles commonly hosted (derived from its events' `dance_styles[]`), website/Instagram if provided, organizer relationships (which organizers run events there).

**Structured data:** `Place`, embedding the same `PostalAddress`/`geo` used in each hosted event's `Event.location` — the venue page's `Place` node and every event's embedded `Place` node should describe the same physical location identically, which is exactly why venues need a normalized table (§27): today that address exists as duplicated free text on every single event row, with no guarantee two events at "the same" venue even use identical spelling.

---

## 15. Organizer SEO

`/organizers/:slug` — **requires the new `organizers` table (§27); does not exist today.**

**Indexable once:** organizer has a description **and** ≥1 published event (upcoming or past) — an organizer stub created but never posting an event is not yet a legitimate landing page.

**Content:** brand name, description, logo, upcoming events, past events, typical dance styles (derived), primary cities (derived), website/Instagram.

**Structured data:** `Organization`, referenced by `Event.organizer` on every event they run (§8) — again, this only becomes *one consistent* Organization node instead of N slightly-different free-text `host` strings once organizers are normalized.

---

## 16. User profile indexing

**`noindex` at launch, full stop — and block via `robots.txt` for any sub-path that could expose account data** (`/profile/`, `/account/` if introduced later exactly as scoped in §4).

Never expose to search engines regardless of future public-profile features: email, RSVP history, moderation flags/status, any field not the user explicitly published as a profile. If/when a genuine public-profile feature ships (bio, public event history as an organizer/attendee, posts) with real content per user, revisit indexing *then*, gated by the same non-thin-content discipline as §11/§12/§14/§15 (a profile with a username and nothing else stays noindex even if the feature technically supports indexing).

---

## 17. Internal-link architecture

The graph the brief sketches is the correct one — implement it as **real `<a>`/`<Link>` elements in rendered content**, not JS-only click handlers, so both users and crawlers traverse it without relying on the calendar-widget-style client interactivity that makes today's `/calendar` a dead end for crawlers:

```
Cities (/cities)
  → Boston (/cities/boston)
      → Salsa Events (filtered view, §16 — not its own indexable URL unless §13's threshold is met)
          → Salsa at the Anchor (/events/salsa-at-the-anchor)
              → The Anchor (/venues/the-anchor)   [venue link]
              → Sabor Latino Boston (/organizers/sabor-latino-boston)  [organizer link]
                  → other events by this organizer
              → other events at this venue
      → Havana Club (venue, cross-linked from any event there)
Dance Styles (/dance-styles)
  → Salsa (/dance-styles/salsa)
      → Salsa events across all cities
      → cross-links into /cities/:city for each represented city
```

**Breadcrumbs** on every page below the top-level browse pages (`Cities / Boston / Salsa at the Anchor`; `Dance Styles / Salsa / Salsa at the Anchor`) — implemented once as a shared component reading route context, paired with `BreadcrumbList` JSON-LD (§8) so the same data serves navigation and structured data from one source instead of two hand-maintained things drifting apart.

**No orphan pages.** Every event links to its venue and organizer (when known); every venue/organizer lists its events; every city/style page lists its events, venues, and organizers. This means the sitemap (§18) becomes a *safety net* for crawl discovery, not the *only* discovery path — which matters because sitemaps alone are a weaker ranking signal than being genuinely link-reachable from the site's own content graph.

---

## 18. Filter / faceted-navigation rules

Filters (`date`, `city`, `dance style`, `venue`, `price`, `event type`, `beginner-friendly`) stay fully functional as query parameters for product UX — the rule is purely about **what search engines are told to do with the resulting URLs**, not about restricting the filters themselves.

| Filter URL shape | Indexability |
|---|---|
| Single, high-intent, pre-defined combination that already has a dedicated clean URL (`/cities/boston`, `/dance-styles/salsa`, and — once §13's threshold is met — `/cities/boston/salsa`) | These get their **own clean URL**, not a query string, and are indexable. |
| Any other filter combination (`?city=boston&style=salsa&free=true`, `?date=2026-08-17`, any 2+-parameter combination, any combination below §13's threshold) | `noindex`, and `canonical` → the nearest clean ancestor URL (e.g., `?city=boston&free=true` canonicals to `/cities/boston`) |
| Pagination (`?page=2`) | `noindex`, canonical → page 1 (or, if the product wants paginated content genuinely discoverable, use `rel=next/prev`-equivalent internal linking rather than relying on pagination params for SEO reach — but do not index page 2+ as separate ranking-eligible URLs) |
| Sort params (`?sort=date`) | Never a distinct crawlable variant — strip from canonical always, regardless of index/noindex status of the base page |

This is enforced at the metadata-generation layer (§20/§3's per-route head management), not by trying to prevent the URLs from existing — the product still needs `?city=boston&style=salsa` to work for a user who clicked two filters; it just never becomes a search-engine-facing surface distinct from its canonical target.

---

## 19. Canonical strategy

| Page type | Canonical target |
|---|---|
| Event (series) | itself, always — `/events/:slug`, no query string |
| Event occurrence with `?date=` param | the series URL, no param |
| Venue, Organizer, City, Dance-style pages | themselves |
| Any filtered/faceted URL | nearest clean ancestor (§18) |
| Any URL with tracking params (`utm_*`, `ref`, `fbclid`, etc.) | the same URL with tracking params stripped |
| Duplicate event submissions (two users submit the "same" real-world event) | resolved at the **data layer**, not via canonical — see §30's duplicate-submission handling; canonical is the wrong tool for admin-side data deduplication, it's for legitimate URL variants of one piece of content |
| Shared/copied event ("Duplicate" admin action, seen in `AdminEventsTable`'s `duplicate` row action) | the *new* copy is a distinct real event by default (different date/instance) and gets its own canonical self-reference — only becomes a canonical-to-original situation if the duplication produced an unintended literal duplicate, which is a data-quality bug to fix at the source, not paper over with canonical tags |

---

## 20. Sitemap architecture

**Do not hand-maintain `public/sitemap.xml` going forward — generate it at build time**, replacing the current static file (which is already wrong, §2).

**Start with a single `sitemap.xml`; split into an index only once it's needed.** At today's and near-term inventory (dozens to low hundreds of events, a handful of cities/venues/organizers/styles), one file is well under the 50,000-URL/50MB sitemap protocol limit and is simpler to generate, validate, and debug. Move to an index (`sitemap.xml` → `sitemap-events.xml`, `sitemap-cities.xml`, `sitemap-venues.xml`, `sitemap-organizers.xml`, `sitemap-static.xml`) once:
- total URL count approaches the low thousands, or
- update-frequency segmentation becomes valuable (events change daily; venue/organizer/city pages change rarely — splitting lets crawlers prioritize the fast-changing segment), whichever comes first.

**Generation mechanism:** the same build-time script from §3 (prerendering) queries Supabase for everything currently indexable per §4/§11/§12/§14/§15's thresholds, and writes the sitemap alongside the prerendered HTML — one data pass produces both, so they can never drift out of sync with each other the way the current hand-written sitemap has already drifted from the actual routes.

**Include only:** published/approved events (not `draft`/`pending`/`rejected`), venues/organizers/cities/styles that meet their indexability threshold, and the static pages. **Exclude:** anything §4 marked noindex, any parameterized/filtered URL, `/admin/*`.

**`<lastmod>`** should reflect real `updated_at` values (requires `events.updated_at` — already exists; venues/organizers will get one via §27) rather than the current file's identical hardcoded date across every entry.

---

## 21. robots.txt strategy

```
User-agent: *
Allow: /

Disallow: /admin/
Disallow: /profile/
Disallow: /auth/callback

Sitemap: https://salsasegura.com/sitemap.xml
```

Notes against the current file (`public/robots.txt`):
- **Uncomment and keep the `/admin/` disallow** — it's currently commented out, meaning it does nothing (§2).
- **Do not** disallow `/signin` — per §4's reasoning, auth pages should stay crawlable-but-noindexed, not blocked, since Disallow'd pages that get linked from elsewhere can still surface bare in results with zero control over the snippet, which is worse than a controlled noindex.
- **Drop the `Crawl-delay` directive** — Google ignores it entirely (crawl rate is managed via Search Console instead, §32), and an unnecessary delay directive only slows down the crawlers that *do* respect it (Bing, some others) for no benefit.
- This file remains static (it doesn't need per-event regeneration, unlike the sitemap) — but it does need this one-time correction before any of the rest of this plan's pages exist, since it's the very first thing a crawler reads.

---

## 22. Metadata templates

One reusable template mechanism (a `usePageMeta({ title, description, canonical, ogImage, robots, jsonLd })`-shaped hook or component, backed by React 19's native head-hoisting per §3), instantiated per route type:

| Route type | title pattern | description pattern | robots |
|---|---|---|---|
| Homepage | `SalsaSegura — Discover Salsa & Bachata Events` (see §23) | static, hand-written once | index |
| `/events` (browse) | `Upcoming Salsa & Bachata Events \| SalsaSegura` | static, hand-written once | index |
| `/events/:slug` | see §7's template | see §7's template | index (or noindex per §10's lifecycle rules) |
| `/cities/:city` | `Salsa & Bachata Events in {city} \| SalsaSegura` | `{count} upcoming salsa, bachata & Latin dance events in {city}. {top_venue_or_style_teaser}` | index once threshold met, else noindex |
| `/dance-styles/:style` | `{style} Events \| SalsaSegura` | `{count} upcoming {style} events across {city_count} cities. {style_blurb_first_sentence}` | index once threshold met, else noindex |
| `/venues/:slug` | `{venue_name} — Salsa & Bachata Events \| SalsaSegura` | `Upcoming salsa, bachata & Latin dance events at {venue_name} in {city}.` | index once threshold met |
| `/organizers/:slug` | `{organizer_name} \| SalsaSegura` | `{organizer_description_first_140_chars}` or generated fallback if no description set | index once threshold met |

Every template has a generated default; **manual override is optional, never required** (only `seo_title`/`seo_description` on `events` per §27, for the rare flagship-event case — city/venue/organizer/style pages don't need overrides at this stage since their templates are entirely data-derived).

---

## 23. Open Graph / social sharing strategy

Per-event OG tags (title/description per §7's template, `og:image` = event flyer) solve the "share to WhatsApp/iMessage/Slack" use case named in the brief — but **only if the sharing bot receives real HTML**, which is exactly why §3's prerendering recommendation exists: Facebook's/WhatsApp's/iMessage's link-preview crawlers do not execute JavaScript, so a CSR-only event page would show the *homepage's* static `og:image`/title for every single shared event link today, regardless of which event was actually shared. This is a concrete, currently-live failure mode the moment any event gets its own URL without prerendering.

**Fallback image:** any event without `image_url` set must still produce a valid `og:image` — a single branded default flyer (SalsaSegura logo + "Salsa & Bachata Events" treatment, sized at the standard 1200×630 already used site-wide per `index.html:59-60`) referenced whenever `events.image_url` is null, so link previews never show a broken-image icon.

**Per-page OG fields**, all populated from the same data as the `<title>`/description templates (§7/§22) — no separate authoring step:
- `og:title`, `og:description`, `og:image` (+ width/height/alt), `og:url` (= canonical), `og:type: "website"`, `og:site_name: "SalsaSegura"` (site-wide constant).
- `twitter:card: "summary_large_image"`, mirroring the OG image/title/description (Twitter/X falls back to OG tags if Twitter-specific ones are absent, but explicit tags are more reliable across the Twitter Card Validator).

---

## 24. Homepage SEO

Current title (`Salsa Segura - Salsa & Bachata | Pop-up Classes & Events`) and description are reasonably clear already, but skew toward the *class/lesson* business rather than the *event-discovery platform* identity this whole phase is building toward. Recommend evolving toward:

```
Title:       SalsaSegura — Discover Salsa & Bachata Events in Boston & NYC
Description: Find salsa, bachata, and Latin dance events, socials, and classes
             near you. Updated daily across Boston, New York, and beyond.
```

"and beyond" (rather than hardcoding just the two current cities into the permanent tagline) leaves room for geographic expansion without needing a homepage-copy rewrite the day a third city launches — the *specific* city breadth is what `/cities` and the city pages communicate in detail; the homepage only needs to signal "this is a multi-city, growing platform," matching the brief's own instruction to "leave room for geographic expansion."

---

## 25. Heading architecture

- Exactly one `<h1>` per page, matching the page's primary subject: the event title on `/events/:slug`, the city name on `/cities/:city`, etc. — never the site name (that belongs in `<title>`/header branding, not `<h1>`).
- `<h2>` for major sections within a page (event page: "Details", "Venue", "Related Events"; city page: "Upcoming Events", "Venues", "Organizers").
- `<h3>` for repeated sub-items within a section (individual event cards' titles when they appear as a `<h3>` inside a `<h2>Upcoming Events</h2>` list, for example).
- Never skip levels or choose a heading tag for its default font-size — that's what `admin.css`'s (and the equivalent public-site) CSS classes are for; heading tags encode document structure, not visual weight.

---

## 26. Image SEO

- **Alt text**: event flyers get `alt="{event.title} flyer"` or, if a short `image_alt` field is later added, that value — **never** the full event description dumped into `alt` (explicitly warned against in the brief; also just bad for screen-reader users, who don't want a paragraph read out for one image).
- **Decorative images** (background textures, icon glyphs already conveyed by adjacent text) get `alt=""`, not omitted — an empty alt is the correct way to tell assistive tech and crawlers "this image carries no independent content," omitting the attribute entirely is worse (some tools then read the filename instead).
- **Responsive images + compression**: event flyers should be served via a modern format (WebP/AVIF with a JPEG fallback) at multiple widths (`srcset`) — flyers are typically uploaded at whatever resolution a phone camera or Canva export produces, often far larger than needed for a card thumbnail vs. a full event-page hero.
- **Lazy loading**: `loading="lazy"` on every event-card/gallery image below the fold (event lists, venue/organizer event history) — **never** on the single hero/flyer image at the top of an individual `/events/:slug` page, since that image is almost always the page's LCP element (§27) and lazy-loading it actively delays LCP.
- **Explicit `width`/`height`** (or `aspect-ratio` CSS) on every event image to reserve layout space before the image loads — this is the direct mechanism for the CLS goal in §27, not a separate concern.
- **Filenames**: where upload naming is controllable (i.e., the admin flyer-upload flow, not necessarily user-submitted filenames), prefer descriptive slugified names over camera-default `IMG_1234.jpg` when feasible — low priority relative to alt/compression/CLS, but cheap once an upload pipeline exists to rename through.

---

## 27. Core Web Vitals & performance

Public pages only (Admin is explicitly out of scope, §3).

| Vital | Primary lever for this product | Concrete guidance |
|---|---|---|
| **LCP** | The event hero flyer image on `/events/:slug`; the first-viewport event-card images on `/cities/:city`, `/dance-styles/:style`, `/calendar` | Prerendering (§3) puts the LCP element's markup in the initial HTML instead of behind a JS render — this alone is usually the single biggest LCP win available. Combine with: no `loading="lazy"` on the hero image (§26), a `<link rel="preload">` for it when it's identifiable at request time, and compressed/appropriately-sized source images. |
| **INP** | Filter interactions on `/calendar`/city pages, the `@schedule-x/calendar` widget's own interactivity | Keep filter state changes cheap (avoid full-list re-fetch-and-rerender on every keystroke — debounce text search, only network-fetch on committed filter changes). This is an existing-app concern more than a new-page concern; flag for the team building the filter UI rather than a net-new recommendation here. |
| **CLS** | Event card grids/lists where images and price/status badges load asynchronously | Explicit image dimensions (§26), reserved space for async badges (pending/cancelled banners, §10) rather than inserting them after initial paint, and font-loading strategy (below). |
| **Fonts** | `index.html:190-193` currently loads three Google Fonts families (`Great Vibes`, `Epilogue`, `Be Vietnam Pro`) via a render-blocking `<link rel="stylesheet">`, with `preconnect` already in place (good) but `display=swap` already set (good — prevents invisible-text FOIT). No change required beyond what's already there; verify this remains true as new pages are built rather than each new page re-requesting fonts independently. |
| **JS bundle size** | New route components | Every new route (`/events/:slug`, `/cities/:city`, `/venues/:slug`, `/organizers/:slug`, `/dance-styles/:style`) should follow the existing `lazy(() => import(...))` pattern already used for every other route in `src/App.tsx` — this is already the established convention in this codebase (§ CLAUDE.md's directory conventions), not a new practice to introduce. |
| **Third-party scripts** | Umami analytics (`index.html:20-24`), Google Fonts | Already deferred (`defer` attribute) and preconnected respectively — no change needed; just don't add new third-party `<script>` tags to public pages without the same deferred/async treatment. |

---

## 28. Local SEO / structured location data

The current model (`events.city` enum, `events.location`/`address` as free text, no lat/lng) cannot power local search, map embeds, "nearby events," or consistent `Place` structured data across an organizer's/venue's multiple events — this is the concrete justification for §27's schema additions, not a generic best-practice checkbox.

**Recommend storing, per venue** (once the `venues` table exists, §27):

```
name, street_address, city, state, postal_code, country, latitude, longitude, timezone
```

This structured location data feeds, from one source of truth instead of N free-text duplicates:
- Search (filter events by proximity once lat/lng exists — not buildable today)
- City pages (§11 — grouping is currently only possible by the coarse `city` enum, not a real geography)
- `Event.location`/`Place` structured data (§8) — consistent across every event at that venue, instead of however each submitter happened to type the address
- Map embeds on venue and event pages
- Future "events near me" — entirely blocked today without lat/lng

`timezone` per venue (not per event) matters specifically because `Event.startDate` in structured data must be an ISO 8601 datetime **with a timezone offset**, and a platform spanning Boston/NYC today with room to expand (§24) cannot safely assume one global timezone forever — better to anchor it to the venue once than to require every event submission to somehow specify it.

---

## 29. Database recommendations for SEO

Categorized against what genuinely doesn't exist today (§0), not assumed pre-existing.

### Recommended Now

**New table `venues`** *(does not exist today — this is new, not an addition to an existing table)*:
```
id, slug, name, street_address, city, state, postal_code, country,
latitude, longitude, timezone, website, instagram_handle,
created_at, updated_at
```

**New table `organizers`** *(does not exist today)*:
```
id, slug, name, description, logo_url, website, instagram_handle,
created_at, updated_at
```

**`events` additions:**
```
slug                     -- required for §5/§6; generated on insert, immutable after
venue_id                 -- FK to venues, nullable during the migration window (§ below)
organizer_id             -- FK to organizers, nullable during migration
published_at             -- distinct from created_at; the moment status → approved,
                            used for sitemap <lastmod> and "new listings" surfacing
timezone                 -- or inherited from venue_id once venues exist; needed for
                            correct structured-data startDate/endDate offsets
end_time / end_date       -- currently only a start time exists; Event.endDate needs it
previous_start_date       -- nullable, set only at the moment of a reschedule (§7/§8)
series_id                 -- nullable FK, groups recurring occurrences into one series (§9)
```

**`profiles` additions:** none required for SEO specifically at this stage (§16 keeps profiles noindexed regardless of field completeness) — no action needed here now.

### Recommended Later (once the corresponding pages are actually being built, not before)

```
events.seo_title                 -- manual override, optional, only meaningful once
events.seo_description           --   /events/:slug ships and a flagship-event need arises
events.canonical_url_override    -- genuinely rare (e.g., a cross-posted/syndicated event);
                                     don't build the field until a real case demands it
events.image_alt                 -- short, human-written alt text distinct from full
                                     description (§26) — nice-to-have, not blocking
redirects table                  -- source_path, destination_path, status_code, created_at
                                     (§30) — needed once the first slug/venue/organizer
                                     rename actually happens, not preemptively
```

### Unnecessary (do not build)

- Manual SEO title/description fields on **every** entity (cities, dance-styles, venues, organizers) — §22's templates are fully data-derived for these; adding editable override fields before there's ever been a reason to override them is speculative surface area with a maintenance cost (someone has to notice a template is wrong and go fill in an override) and no current benefit.
- A generic polymorphic "SEO metadata" table (`seo_meta(entity_type, entity_id, title, description, ...)`) — tempting as a one-size-fits-all abstraction, but it decouples SEO fields from the entities' own migrations/RLS policies for no current payoff at this scale; plain nullable columns on each table (as above) are simpler, and this codebase's own conventions favor boring, direct schema over speculative generalization (per this project's engineering norms observed throughout the Admin work this session).
- Per-event structured-data override fields (raw JSON-LD stored per event) — the generated markup in §8 should always be derivable from the same fields already recommended above; an escape hatch to hand-author arbitrary JSON-LD is a correctness risk (drift from visible content, exactly what the brief's "must match information visible to users" rule exists to prevent) with no identified use case yet.

---

## 30. Redirect strategy

**Not needed immediately** — there are currently zero public URLs with any search equity to preserve (no event pages exist yet, §0). It becomes needed the moment the *first* slug/venue/organizer rename happens post-launch, so build the table alongside the entities it protects rather than before:

```
redirects: source_path, destination_path, status_code (301 default), created_at
```

Populate automatically whenever an event/venue/organizer's slug changes (a deliberate rename, not the normal immutable-slug case from §6) — the application writes one row at the moment of rename, not a manually curated list. Serve via a lightweight lookup at the edge/routing layer (Azure SWA supports `staticwebapp.config.json` route rules for a small number of redirects; a growing table should be checked via the app's own router before falling through to the 404/`NotFoundPage`, since SWA's static config isn't meant to hold a large, frequently-changing redirect list).

---

## 31. Duplicate-content prevention

| Risk | Prevention |
|---|---|
| Recurring events generating near-identical pages | §9 — series-page model, occurrences never independently indexable |
| Same real-world event submitted by multiple users | Prevention at the **submission/moderation layer** (fuzzy-match on title + venue + date range at submission time, surfaced to the moderator reviewing the pending queue — an admin-workflow feature, not an SEO mechanism) rather than an SEO-layer fix; if two duplicate events do slip through and both get published, the fix is an admin merge action (archive one, redirect its slug to the other via §30), not a canonical tag between two otherwise-independent event rows |
| Filter/faceted URLs | §18/§17 — noindex + canonical to clean ancestor |
| Similar/thin venue or organizer pages | §14/§15's indexability thresholds — a page with no real content doesn't index in the first place, which prevents it from ever being a "duplicate" of anything (empty pages tend to look like duplicates of each other, not of anything specific — the fix is not indexing them at all) |
| Tracking-parameter URLs | §17/§19 — always canonicalized to the param-stripped URL |
| "Duplicate event" admin action producing accidental true duplicates | §19 — data-quality issue to catch at the source (the duplicate action is meant to seed a *new, different* event from a template, not clone an identical listing); if it does produce an unintended identical copy, that's an admin cleanup task, not something SEO tooling should mask |

---

## 32. Search Console / Bing setup

Set up once event pages exist and are prerendered (setting these up against today's single-page CSR shell would produce misleading/empty coverage reports):

1. **Domain-level verification** (DNS TXT record) in Google Search Console and Bing Webmaster Tools — domain-level (not URL-prefix) verification so it covers the whole site regardless of future subdomain/path changes.
2. **Submit `sitemap.xml`** (§20) in both.
3. **Monitor Coverage/Page Indexing report** for: pages excluded by noindex (confirm it matches §4's intent — nothing unintentionally noindexed), "Discovered — currently not indexed" (a signal prerendering/internal-linking isn't reaching a page), duplicate-without-canonical warnings (a canonical gap somewhere in §19).
4. **URL Inspection tool** for spot-checking that a newly-published event's rendered/indexed HTML actually contains the expected title, description, and `Event` structured data — the fastest way to catch a prerendering regression before it affects the whole catalog.
5. **Rich Results Test** / **Schema Markup Validator** against `/events/:slug`, `/venues/:slug`, the homepage — before and after any structured-data change.
6. Bing Webmaster Tools additionally offers a **URL Submission** API/quota worth using for newly-published high-value events (flagship/large events) to accelerate initial discovery, given Bing doesn't share Google's crawl frequency.

This is genuinely sufficient on its own — no paid third-party SEO tool is required for a foundational launch (per the brief's own instruction not to make SEO dependent on paid tooling).

---

## 33. Minimal SEO monitoring plan

A single-owner-operable checklist, not a dashboard product:

**Weekly (5 minutes):**
- Search Console Coverage report: any new errors, any spike in excluded/noindexed pages
- Search Console Core Web Vitals report: any regression on mobile

**Monthly (20 minutes):**
- Sitemap freshness: URL count roughly tracks published-event/venue/organizer counts (a mismatch means the generation script broke silently)
- Spot-check 3-5 random `/events/:slug` pages via URL Inspection + Rich Results Test
- Review top organic queries/landing pages in Search Console Performance report — sanity-check that event/city pages (not just the homepage) are starting to appear
- 404/410 report: anything unexpected (should be near-zero given §10's no-immediate-404 policy — a spike here signals a broken slug/redirect, not normal event lifecycle)

**Per-deploy (automated, not manual):**
- CI already runs lint + `vitest run` (`.github/workflows/azure-static-web-apps-lemon-stone-01afe980f.yml:24-27`) — extend this gate with: sitemap XML validity (well-formed, all URLs 200-reachable pre-deploy), a structured-data lint pass (JSON-LD parses and required `Event` fields are present) on a sample of prerendered pages, and a broken-internal-link check across the site graph (§17). This keeps SEO regressions caught the same way test/lint regressions already are in this repo, rather than discovered weeks later in Search Console.

---

## 34. Programmatic SEO guardrails

The platform's real programmatic surfaces are city×style (§13), and (later) city×style×date-range ("this weekend," "this month"). **Every one of them is gated by an explicit, checked-at-generation-time indexability threshold — never by simply enumerating the cartesian product of known cities/styles/dates.**

Concrete guardrail, restated as a single rule applied everywhere in this doc: **a combination page is generated as noindex by default; it flips to index only when a data-driven threshold check passes** (§11's 5-events/2-venues city threshold, §13's 3-events/1-venue city×style threshold, §14/§15's venue/organizer content thresholds). This is enforced in the same build-time generation pass that produces the sitemap (§20) — a page that doesn't pass its threshold simply never appears in the sitemap and carries `noindex`, so "expand to a new city with zero events" can never accidentally produce a live, empty, indexed landing page.

Explicitly do **not** build: date-based programmatic pages (`/events/boston/2026-08-17`) beyond what §9 already covers via the occurrence-param pattern, or any city×style×venue triple-combination page — these have not been shown to have independent search intent distinct from their parent pages, and building them speculatively is exactly the "thin programmatic pages" the brief opens by warning against.

---

## 35. Analytics compatibility

Not building analytics in this phase — but the page-identifier stability this phase establishes is what makes future measurement reliable:

- **Slugs are permanent** (§6) → landing-page reports in GA4/Search Console stay attributable to the same URL over an event's/venue's/organizer's lifetime instead of fragmenting across renamed URLs.
- **Canonical URLs are consistent** (§19) → "organic landing page" reports aggregate correctly instead of splitting traffic across `?utm_source` variants of the same page.
- **Route structure is semantic** (`/events/:slug`, `/cities/:city`, `/venues/:slug`, `/organizers/:slug`) → future analytics can segment "event-page traffic" vs. "city-page traffic" vs. "organizer-page traffic" by URL pattern alone, without needing a separate page-type tagging system bolted on later.
- **`published_at`** (§27) → lets a future "time to first organic click" or "how fast does a new listing get discovered" metric exist at all — impossible to reconstruct retroactively if not captured from day one.

No GA4/GSC-linking, event-tracking taxonomy, or conversion-funnel work is in scope here — noted only so the URL/data foundation doesn't have to be reworked when that phase does happen.

---

## 33 (deliverable numbering). Prioritized implementation checklist

### Before Launch (of the events-as-pages feature — i.e., required to ship `/events/:slug` at all)

- [ ] Fix `robots.txt`: uncomment `/admin/` disallow, add `/profile/`, `/auth/callback`; drop `Crawl-delay` (§21)
- [ ] Per-route `<head>` management (React 19 native title/meta hoisting) wired into every existing route, eliminating the single-static-head problem before any new routes are added (§3/§22)
- [ ] New `venues` table + `organizers` table (§27)
- [ ] `events` additions: `slug`, `venue_id`, `organizer_id`, `published_at`, `timezone`, `end_time`/`end_date`, `previous_start_date`, `series_id` (§27)
- [ ] `/events` (index) and `/events/:slug` routes, with §7's automatic metadata template and §8's `Event` JSON-LD
- [ ] Canonical tag support per route (§19)
- [ ] Build-time prerendering mechanism for `/events/:slug` (§3) — at minimum event pages; venue/organizer/city can follow immediately after if not simultaneous
- [ ] Dynamic sitemap generation replacing the static, already-incorrect `public/sitemap.xml` (§20)
- [ ] Cancelled/rescheduled/finished lifecycle rendering + structured-data mapping (§10)

### First 30 Days (post-launch of event pages)

- [ ] `/venues/:slug`, `/organizers/:slug` routes + prerendering, gated by their content thresholds (§14/§15)
- [ ] `/cities/:city` pages, gated by §11's threshold
- [ ] `/dance-styles/:style` pages, gated by §12's threshold, including the one-time-written per-style context blurb
- [ ] Breadcrumb component + `BreadcrumbList` structured data across all new page types (§17/§8)
- [ ] Recurring-series grouping (`series_id`, `eventSchedule` structured data) (§9)
- [ ] Open Graph fallback image for events without a flyer (§21)
- [ ] Filter-URL noindex/canonical enforcement (§18)
- [ ] Google Search Console + Bing Webmaster Tools setup, sitemap submission, initial URL Inspection spot-checks (§32)
- [ ] CI gate additions: sitemap validity, structured-data lint, broken-internal-link check (§33)
- [ ] Social-preview validation (Facebook Sharing Debugger, Twitter Card Validator) against real prerendered event URLs (§23)

### Later Growth Phase

- [ ] City×dance-style combination pages, gated by §13's threshold
- [ ] Redirect table + automatic population on slug/venue/organizer rename (§30)
- [ ] Past-event noindex-after-window policy execution (§10/§31)
- [ ] `seo_title`/`seo_description`/`canonical_url_override` manual-override fields on `events`, if a real flagship-event need materializes (§27)
- [ ] Incremental/on-demand prerendering (webhook-triggered single-page regeneration) if build-time-only freshness becomes a real problem (§3)
- [ ] Public user-profile indexing, if/when a genuine public-profile feature ships with real per-user content (§16)
- [ ] Full SSR / React Router v7 framework-mode migration — only if prerendering's limits are actually reached (§3)
- [ ] "Events near me" / proximity search, unlocked by §27's lat/lng data existing (§28)
