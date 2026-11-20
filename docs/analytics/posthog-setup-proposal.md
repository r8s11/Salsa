# PostHog setup audit and proposal

Status: proposal, 2026-05. Investigation only; no code or PostHog project settings changed.

Goal: answer "which channel/campaign brought dancers who RSVP'd or organizers who
submitted" for organic social (`@salsasegura` IG/TikTok, `utm_medium=organic_social`)
and later paid social (`utm_medium=paid_social`, scheme in the paid-social plan:
`utm_source=meta|tiktok|pinterest`, `utm_campaign=<city>_<objective>_<yyyymm>`).

## 1. Current state

**Init** (`src/main.tsx`): `posthog-js ^1.446.0`, loaded lazily via
`startPostHog` (`src/shared/analytics/posthog.ts`) after first render. Options:
`api_host`, `persistence: "memory"`, `capture_exceptions: true`,
`logs: posthogLogsConfig` (service `salsa-segura-web`). No `capture_pageview`,
`defaults`, `person_profiles`, or super properties are set. Startup deletes this
project's legacy `ph_<key>_posthog` cookie/localStorage entries.

**Env/keys**: `VITE_POSTHOG_KEY` must start with `phc_` (startup throws otherwise);
`VITE_POSTHOG_HOST` required in dev. Neither set → `disablePostHog()`.

**Persistence**: memory only. Anonymous `distinct_id`, session and initial
referrer/UTM properties live for one page load. In-app (SPA) navigation keeps
them; a reload, new tab, or return visit starts a new anonymous person.

**Identify/reset** (`src/contexts/AuthContext.tsx`): on user change,
`posthog.identify(user.id, { email, role })`; `posthog.reset()` on sign-out or
user switch. No `$set_once` attribution properties, no `alias`.

**Defect: the lazy-load queue is bypassed.** Every caller (AuthContext and all
10 capture sites) does `import posthog from "posthog-js"` directly; only
`main.tsx` uses the queued wrapper. Consequences:
- `posthog-js` is statically in the entry chunk (via `AuthProvider`), defeating
  the lazy load.
- Calls that run before `init` finishes hit an uninitialised singleton, which
  posthog-js drops. The restored-session `identify` in AuthContext fires on
  mount and is the likeliest casualty → returning signed-in users may stay
  anonymous for the whole page load. Verify in PostHog Live events before fixing.

**UTM/referrer capture**: nothing app-side; no code reads `utm_*` or
`document.referrer`. posthog-js auto-attaches campaign params/referrer to the
landing `$pageview` and session-entry properties, but only for that page load.
Only the initial `$pageview` is captured (no `history_change` mode configured),
so SPA route changes produce no `$pageview`. Umami (`index.html`) records
visit-level UTM/referrer cookielessly.

**Events and properties**

| Event | File | Properties | city | event id | organizer id |
| --- | --- | --- | --- | --- | --- |
| `event_rsvp_clicked` | `pages/EventDetailPage.tsx` | `city, event_type, attendance_type` | yes | no | no |
| `event_calendar_downloaded` | same | `city, event_type` | yes | no | no |
| `event_shared` | same | `city, event_type, method` | yes | no | no |
| `event_submitted` | `submit-event/hooks/useSubmitEventForm.ts` | `city, event_type, has_flyer, flyer_count, is_authenticated` | yes | no | via identify only |
| `event_submission_approved` / `_rejected` | `admin/pages/AdminSubmissionDetailPage.tsx` | taxonomy counts / none | no | no | no (actor is the admin) |
| `event_submission_updated` / `_withdrawn` | `pages/UserEventEditPage.tsx` | `is_organizer` (+ update fields) | no | no | no |
| `host_event_created` | `pages/host/HostCreateEventPage.tsx` | `published, has_flyer, flyer_count` | no | no | via identify only |
| `attendee_checked_in` | `pages/host/HostCheckInPage.tsx` | `method` | no | no | no |
| `onboarding_completed` | `pages/account/OnboardingPage.tsx` | `completion_method` | no | n/a | n/a |
| `product_added_to_cart` / `checkout_started` | `shopify/cart/*` | `quantity` / `item_count` | no | n/a | n/a |

No PostHog `event_viewed` exists; event views are Umami-only
(`event-view:<metro>` via `recordEventTouch`, which honours DNT/GPC). PostHog
captures do not honour DNT/GPC. Submission logs go to PostHog Logs.

**Privacy text** (`src/pages/PrivacyPage.tsx`): says PostHog uses no cookies or
browser storage, identifier lasts "for the current page view", signed-in
activity can be linked to the account; no advertising cookies; DNT/GPC stops
event-touch recording. No consent banner. Any persistence change must update
this page in the same release.

## 2. Gaps vs goal

1. **First-touch UTM across sessions**: none. A dancer who lands from IG, leaves,
   and RSVPs tomorrow is unattributed. An organizer who lands from a campaign and
   submits after signup/email confirmation (new tab) is unattributed.
2. **Attribution after signup**: identify has no `$set_once` of first-touch
   UTM/referrer, and the magic-link/OAuth return opens a new page load, so the
   pre-signup anonymous person (and its UTMs) is lost before `identify`.
3. **Early-call loss**: see defect above; fix before trusting any number.
4. **City on every event**: present on 4 of 13 events. Should be a super property
   (`metro`, from `useCity()`) plus the event's own `city` where an event exists.
5. **IDs**: no `event_id` on any event; no organizer entity id. Needed to join
   with `event_touches` and Supabase and for future pixel/CAPI dedupe.
6. **Funnels not definable**: no `$pageview` on SPA navigation and no PostHog
   `event_viewed`, so "visit → event view → RSVP click" can't be built;
   "visit → submit" lacks a `submit_started` step.
7. **No dashboards/insights** defined.

Target funnels (all broken down by `utm_source`, `utm_medium`, `utm_campaign`, `metro`):
- Dancer: `$pageview` → `event_viewed` → `event_rsvp_clicked` (14-day window).
- Organizer: `$pageview` → `submit_started` → `event_submitted` → `event_submission_approved` (approval joined by `submission_id`).

Insights/dashboard ("Acquisition"): the two funnels; RSVP clicks by
first-touch `utm_campaign` weekly; submissions by first-touch source; landing
pages by `utm_content`; weekly reconcile table PostHog vs Umami visits by source.

## 3. Options: persistence + consent

**(a) Cookieless/memory + first-party UTM stash.** Keep `persistence: "memory"`.
On landing, read `utm_*`/referrer and stash first-touch in `sessionStorage`
(tab-scoped, cleared on close); register as super properties; on signup/submit,
write it server-side (submission row and profile, plus `$set_once` on identify).
Pros: matches current privacy text with a small edit, no banner, no ePrivacy
consent issue for analytics IDs, low effort. Cons: anonymous dancers attributed
only within the visit (most social → RSVP clicks happen in one visit, so most of
the dancer funnel survives); no anonymous multi-visit attribution; magic-link
return in a new tab loses the stash unless carried in the auth redirect URL.

**(b) localStorage/cookie persistence behind a consent banner.**
`persistence: "localStorage+cookie"` with `opt_out_capturing_by_default` until
consent; `cookieless_mode`/memory for decliners. Pros: full first-touch across
sessions for consenters; same banner later gates Meta/TikTok pixels (the paid
plan already lists a banner as a pre-spend blocker). Cons: banner UX friction,
consent rates of 40–70% shrink and bias the sample, more build and legal text.

**(c) Cookie persistence without banner.** Best data, least work. Legal risk:
EU/UK visitors need consent for non-essential storage (ePrivacy); several US
state laws (CA, CT, CO, NJ, etc.) require opt-out and GPC honouring for
targeted advertising, and analytics IDs shared with ad platforms drift into
that. Also contradicts the current privacy page and the site's stated
"cookieless" posture. Not recommended.

**Recommendation: (a) now, (b) when paid pixels go live.** Organic social
traffic is mostly single-visit, and organizer attribution is captured
server-side at signup/submit, which is the durable record anyway. Paid launch
needs a banner for pixels regardless; add PostHog persistence to that same
consent at that point instead of building two consent paths.

## 4. Implementation plan (not implemented)

| # | Task | Est. |
| --- | --- | --- |
| 1 | Route all callers through the queued wrapper in `shared/analytics/posthog.ts` (add `register`; identify already accepts `$set_once` as its third argument); remove direct `posthog-js` imports; test that pre-init calls flush. | 2 h |
| 2 | Init: `capture_pageview: "history_change"`, `person_profiles: "identified_only"`; confirm in Live events that SPA navs emit `$pageview` with session-entry UTMs. | 1 h |
| 3 | `shared/analytics/attribution.ts`: on first load read `utm_*` + referrer, store first-touch in `sessionStorage`, `register` as `ft_utm_*` super properties. Unit tests. | 2 h |
| 4 | Register `metro` super property from `useCity()` on change. | 0.5 h |
| 5 | Add `event_id` to event-detail captures; add `event_viewed` (honour DNT/GPC like `recordEventTouch`); add `submit_started` on first form interaction; add `submission_id`/`city` to submit, approve, update, host-create events. | 3 h |
| 6 | Carry first-touch through auth: add `ft` params to the auth redirect (`getCallbackUrl`), then `identify(id, props, { $set_once: ft_utm_* })`. | 2 h |
| 7 | Migration: nullable `attribution jsonb` on `event_submissions` (and profile); `createSubmission()` writes the stash. Keep public views unchanged. | 2 h |
| 8 | Privacy page + `docs/operations/analytics.md`: describe session-scoped UTM storage and submission attribution. | 1 h |
| 9 | In PostHog UI (owner): create the two funnels, "Acquisition" dashboard, weekly Umami reconcile note. | 1.5 h |
| 10 | Later, with paid launch: consent banner (option b) gating Meta/TikTok pixels and PostHog `localStorage+cookie`. | 1–2 d |

Tasks 1–2 first: until they land, existing numbers undercount identified users.
Total for (a): about 2 days.
