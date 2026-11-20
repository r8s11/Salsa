# Analytics

Run commands from the repository root. [Project setup](../../README.md).

## Analytics baseline

Umami in `index.html` is the cookieless visit source. PostHog uses memory-only
persistence for existing product events, exceptions and submission logs.
Startup removes this project's legacy PostHog cookie/localStorage entries,
without touching Supabase authentication. Anonymous PostHog identity does not
survive reloads; signed-in `identify` calls still identify accounts.
Cookieless is not a claim of complete anonymity or a substitute for a privacy review.

All PostHog calls go through `src/shared/analytics/posthog.ts`, which queues
calls made before the lazily loaded SDK initializes; ESLint rejects direct
`posthog-js` imports. Do Not Track or Global Privacy Control skips PostHog and
attribution entirely (`src/shared/analytics/privacySignal.ts`).

First-touch attribution (`src/shared/analytics/attribution.ts`): the landing
URL's `utm_*` parameters, external referrer host and landing path are held in
memory for the tab and registered as `first_*` PostHog super properties.
`createSubmission()` stores them in `event_submissions.first_touch`; signup
stores them in auth `user_metadata.first_touch` (survives a confirmation link
opened in a new tab), and the next signed-in load copies them to
`profiles.first_touch` through the set-once `record_profile_first_touch` RPC
(accounts under 7 days old only) and to PostHog person properties via
`$set_once`. OAuth redirects start a new page load, so OAuth signups lose the
landing UTMs. `metro` is registered on every event from `useCity()`. Apply
`supabase/migrations/20261121000000_first_touch_attribution.sql` before
deploying the frontend that writes these columns.

PostHog product events: `$pageview` (SPA history changes), `event_viewed`,
`event_rsvp_clicked`, `event_shared`, `event_calendar_downloaded` (all with
`event_id`, `city`, `organizer_id`), `event_submitted` (`submission_id`,
`city`), `event_submission_approved|rejected` (`submission_id`, `city`),
`event_submission_updated|withdrawn` (`event_id`), `host_event_created`
(`event_id`, `organizer_id`, `city`), `attendee_checked_in` (`event_id`),
`onboarding_completed`, `product_added_to_cart`, `checkout_started`. Funnel
and dashboard definitions: `docs/analytics/posthog-setup-proposal.md`.

Event detail pages and modals send metro-tagged Umami events through the existing
`recordEventTouch` boundary:

| Event | Meaning |
| --- | --- |
| `event-view:<metro>` | An event detail was opened |
| `rsvp-click:<metro>` | Free-event registration link activated |
| `ticket-click:<metro>` | Paid-event ticket link activated |
| `event-share:<metro>` | A share action was activated, not proof the share completed |

`<metro>` is the event's metro, not visitor geolocation; missing metros use `none`.
Custom events honor Do Not Track and Global Privacy Control. Views retain the
existing per-event/day session dedupe; actions count each activation. No visitor
identifier is added to the first-party `event_touches` table. Blocked analytics,
changing IP/browser inputs and multiple devices affect the visitor proxy.

### Weekly returning dancers

Run `node scripts/repeat-dancers.mjs <YYYY-MM> <metro-slug>` with a server-side
`UMAMI_API_KEY` from the owner's Umami Cloud account. Do not prefix this key with
`VITE_` or expose it in a browser. The site ID defaults to the existing HTML tag;
`UMAMI_WEBSITE_ID` and `UMAMI_API_URL` optionally override the reporting target.

A dancer is an anonymous Umami visitor who triggered `event-view:<metro>`.
For a completed New York ISO week W, returning dancers were active in W and W−1.
The returning share divides returning dancers by active dancers in W; it is not
cohort retention against W−1's audience. Umami rotates anonymous identifiers
monthly. The script assumes UTC salt-month boundaries, excludes cross-boundary
or incomplete observation windows, and emits `null` rather than false zeroes for
unavailable weeks. The Cloud rotation instant still needs owner verification.
No persistent tracking ID is introduced to bridge months. Baseline collection
starts when these custom events deploy; earlier periods cannot establish return rates.

### Recurring coverage

Apply `supabase/migrations/20261028000000_admin_coverage_score.sql` before deploying
the new `/admin/analytics` coverage section. The admin-only RPC is independent of
the reporting-period filter. Default score:

**100 × tracked recurring nights with an approved listing in the next 14 New York
calendar days / tracked recurring nights.**

A tracked night occurred on at least two distinct dates in the previous 28 days.
Identity uses an active linked series when available, otherwise normalized title,
venue/location and New York weekday. Duplicate same-day records do not establish
recurrence. Today is included in the forward window; its end is exclusive.
Zero tracked nights means no score, not 0% or 100%. The UI exposes missing-night
queues per metro. This measures continuity of known recurring listings, not total
real-world market coverage; renamed events and unlinked venue aliases can split a night.

Rollback-only local SQL verification:
`docker exec -i supabase_db_Salsa psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/manual/admin-coverage-smoke.sql`.
