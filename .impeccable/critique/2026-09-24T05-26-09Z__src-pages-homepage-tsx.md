---
target: homepages
total_score: 19
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 2
target_identity: "file:/home/r8s/code/Salsa/src/pages/HomePage.tsx"
target_fingerprint: "sha256:d4ae38e7f6f0ee55845363b4098c456b405abc08bcad8bb2f362a37fdb5ea5ec"
target_path: /home/r8s/code/Salsa/src/pages/HomePage.tsx
timestamp: 2026-09-24T05-26-09Z
slug: src-pages-homepage-tsx
closed: true
---
Method: dual-agent (A: CritiqueDesignReview · B: CritiqueDetectorEvidence)

Target: `/` homepage (src/pages/HomePage.tsx → Hero, Events, HomeCta) in Boston and New York contexts, desktop 1440 + mobile 390.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Proper aria-busy skeleton; hero stats blank for ~1s on city switch with no placeholder |
| 2 | Match System / Real World | 2 | "Featured Tonight" (Events.tsx:91) is hardcoded for the next event, whatever its day |
| 3 | User Control and Freedom | 3 | Modal closes by X / Escape; error state offers only a reload |
| 4 | Consistency and Standards | 1 | Events.css never loads on a cold `/` visit, so the whole Events section renders unstyled; plus an off-brand photographic fallback flyer |
| 5 | Error Prevention | 3 | Read-only surface; filters and city switch reversible |
| 6 | Recognition Rather Than Recall | 4 | City restated in eyebrow, subtitle, stats, ticker, tab bar |
| 7 | Flexibility and Efficiency | n/a | Public discovery surface |
| 8 | Aesthetic and Minimalist Design | 2 | Strong hero undone by unstyled feed; three CTAs compete; ticker + spin + glow at once |
| 9 | Error Recovery | 1 | Raw Postgrest message shown verbatim beside an unstyled button |
| 10 | Help and Documentation | n/a | Not expected on a discovery landing |
| **Total** | | **19/32** | **Acceptable (59%)** |

## Design Specificity Verdict

Authored, not interchangeable: the spinning vinyl prints the next real event's title, time and venue on its curved label (Hero.tsx:136-163); dance-floor vocabulary ("This Week's Floor", "Tonight on the floor"); city scoping threaded through every hero token. Lapses: HomeCta ("Ready to Dance? / Get in Touch") is a generic contact strip; `default-event-banner.png` is a photographic, AI-looking poster in the same rotation as four flat on-brand SVGs (eventModalImage.ts:3-6), about 1 in 5 flyerless events.

Deterministic scan: CLI 19 advisory findings (exit 0): design-system-font-size 12, design-system-color 6, codex-grid-background 1. Browser overlay (headless): radial-spotlight-glow x2, line-length (home-cta__body ~157ch), wide-tracking (footer copyright), text-occlusion (desktop: ticker pause icon over a ticker item; mobile: vinyl print title under the primary CTA), all-caps-body, marquee, repeating-stripes, grid background.
False positives: vinyl print 6.6px/3.6px (SVG artwork, exempt per DESIGN.md); section-heading clamps within the 1.5–4.5rem display band (Events.css:95/118/165/371, HomeCta.css:22, Header.css:441, Hero.css:352); rose glows (sanctioned "neon" glow); marquee on mobile (ticker is display:none <640px).
Real drift: hero display clamp max 8rem and 4.75rem exceed the 4.5rem band (Hero.css:298, 587); subtitle 1.2rem off the UI ramp (Hero.css:318); off-palette #ef2c58/#9c1035 (Hero.css:151), rgba(124,147,233,.35) (Events.css:322); grid-line hero background not in DESIGN.md (Hero.css:244).

## Overall Impression

The hero is the best thing on the site: a real, data-driven record that sounds like a dance floor. Then a cold landing on `/` drops into an Events section with no stylesheet at all. Biggest opportunity: make the feed as authored as the hero, and make "tonight" true.

## What's Working

1. Vinyl hero is data, not decoration: the next event is pressed into the label.
2. Contrast discipline: tokens documented with AA ratios in global.css; measured 14.3:1 headings, 10.9:1 body; primary CTA 4.70:1 at the lightest gradient stop (passes, barely).
3. City context is exact: Boston/NYC swap updates eyebrow, subtitle, stats, ticker, feed, modal with no stale references.

## Priority Issues

**[P0] Events section ships unstyled on a cold `/` visit**
- Why: `Events.css` (featured card, grid, event cards, filters, error state) is imported only by `Calendar.tsx:23`, a lazy route. Events.tsx, EventCard, FeaturedEventCard import no CSS. Measured on fresh load: `.events-grid` display:block, `.event-card` transparent background, filter chips 18.8–63.8 × 19px with padding 0 and min-height 0 (the rule says 44px). It only looks right after the user has visited /calendar in the same session.
- Fix: `import "./Events.css"` in Events.tsx (or split per component: EventCard, FeaturedEventCard); verify first-load computed styles.
- Command: $impeccable harden

**[P1] "Tonight" is promised, not verified**
- Why: `<h2>◆ Featured Tonight</h2>` (Events.tsx:91) labels the chronologically next event even when it is days away; the primary CTA "Tonight on the floor" is just `#events`. On a quiet night the trusted-guide positioning breaks for the exact user who came to check tonight.
- Fix: compare featured event's America/New_York date to today; "Tonight" only when true, otherwise "Next up · Fri 26 Sep"; add a designed "nothing tonight in {city}, here's what's next" state; CTA copy follows the same truth.
- Command: $impeccable harden

**[P1] Error state leaks a raw backend message**
- Why: Events.tsx:77 renders `Failed to load events: {error}` — observed live as "Could not find the table 'public.public_events' in the schema cache" — beside a default-HTML "Try again" that calls `window.location.reload()`. The hero's stats read 0 above it.
- Fix: map errors to plain copy ("We couldn't load {city}'s floor right now"), styled retry that refetches the query instead of reloading, secondary link to /calendar; log the raw message, never render it.
- Command: $impeccable clarify

**[P2] Off-brand fallback flyer**
- Why: default-event-banner.png is photographic and AI-looking beside four flat rose/gold SVGs; it lands on the featured card roughly 1 in 5 flyerless events, the most prominent slot on the page.
- Fix: drop it from `EVENT_FALLBACK_FLYERS` or replace with a fifth on-brand SVG; update tests that pin the filename (FeaturedEventCard.test.tsx:57 and the regexes in EventCard/EventModal/AdminEventsTable/EventDetailPage tests).
- Command: $impeccable polish

**[P2] Mobile first viewport loses scope, city control, and clarity**
- Why: at 390px the only sentence that says what the product covers is `display:none` (Hero.css:591-593); city switch is not tappable until 420px of scroll or inside the hamburger drawer (the tab-bar city badge is aria-hidden display only); the vinyl (z-index 3, y 147–475) sits under the primary CTA (y 294–346) and the detector reports its printed title 50% occluded.
- Fix: one-line mobile subtitle; compact BOS/NYC toggle in the mobile header; move or shrink the vinyl so it never sits behind the CTA.
- Command: $impeccable adapt

## Persona Red Flags

**Jordan (First-Timer, mobile)**: no subtitle, so "Find Your Rhythm." could be a dance school; wrong default city has no visible fix without the drawer; on first visit the event grid below is raw unstyled markup.
**Alex (frequent local dancer)**: grid capped at 6 (Events.tsx:46) with no more; no date filter beside type; same marquee + spinning hero every visit.
**Sam (keyboard / AT)**: aria-busy skeleton, aria-pressed filters, Escape close are good; the ticker's pause control overlaps a ticker item on desktop; on cold load the filter buttons are 19px tall, below touch minimums.
**Dancer checking "what's on tonight in Boston" on a phone**: the right CTA is under their thumb, then "Featured Tonight" may be Saturday and there is no tonight-only view or honest empty state.

## Minor Observations

- HomeCta copy is category-generic and its body runs ~157 characters per line (HomeCta.css; cap ~65ch).
- Footer always reads "Greater Boston & NYC" and uses 0.10em tracking on body text.
- "Venues" stat counts all upcoming venues while its neighbour counts this week (Hero.tsx:44-45, 58-59).
- City naming is asymmetric: "Greater Boston" vs "NYC" in the same slot.
- Hero stats blank for ~1s on city switch with no placeholder.
- Desktop header shows 7 peer targets in one row.
- Same 3–4 events repeat in ticker, featured card, and grid within one scroll.
- Floating city pill buttons 48×24 on mobile.

## Questions to Consider

- What if the homepage answered "tonight in {city}" directly, with an honest no for quiet nights?
- Does the close need a contact strip, or should it end on the record: "Put your night on the record — submit an event"?
- Should Boston and New York look like different rooms, not the same room with swapped words?
