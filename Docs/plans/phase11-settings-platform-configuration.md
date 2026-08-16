# Phase 11 — Settings & Platform Configuration UX/UI

> **Design and manual-SQL delivery for the SalsaSegura Admin Dashboard.** No SQL in this directory has been executed against production.

## 1. Context

Settings must give an administrator a small, auditable surface for product-level behavior—not a miscellaneous form that leaks infrastructure decisions into the dashboard. A setting is eligible only when SalsaSegura can explain its effect, show its current value, enforce it at the real authorization boundary, and recover safely.

This phase is `/admin/settings` only. It does not start Audit Logs, Analytics, a translation-management system, credential administration, or a visual page builder.

## 2. Grounded state of the codebase

| Existing state | Evidence | Phase 11 consequence |
|---|---|---|
| Settings is a disabled `Soon` item in `AdminSidebar`. There is no settings route/page. | `src/components/Admin/AdminSidebar.tsx`; `src/App.tsx` | The first implementation adds one admin-only route and makes this navigation item real. Moderators do not receive it. |
| Site title, description, canonical URL, social data, JSON-LD, and Umami id are deployment-time values in `index.html`. | `index.html` | They are **not** editable settings. Persisting them would create controls that do not change the delivered static HTML. |
| The app currently accepts only `boston` and `new-york-city`; both use `America/New_York`. | `src/contexts/CityContext.tsx`; `src/utils/ics.ts` | City, country, locale, currency, and time-zone defaults are structured fields. Multi-time-zone support is deferred. |
| Phase 7 stores visitor suggestions in `event_submissions`, with separate authenticated and anonymous insert policies. | `supabase/migrations/20260817000000_event_submissions.sql` | Submission switches must be enforced in those RLS policies, not merely by hiding the form. |
| An older anonymous `INSERT` policy remains on `events`. | `supabase/migrations/20260809000000_events_insert_policy.sql`; `20260815000000_users_management.sql` | It is a bypass of the Phase 7 hard cutover. It must be removed in the same release that makes submission controls live. |
| `is_moderator()` intentionally grants admins and moderators access to moderation data. | `20260817000000_event_submissions.sql` | Platform settings require a separate admin-only predicate; moderators cannot inspect or alter them. |
| `audit_logs.entity_id` is a UUID. | `20260813000100_audit_logs.sql` | A singleton boolean configuration row has no UUID entity id. Its audit entries use `entity_type = 'platform_settings'`, `entity_id = null`, and a value-free changed-key list. |

## 3. Core architecture decision

Use one **strongly typed singleton** `platform_settings` row. It is deliberately not a generic `key`/`value` table.

| Decision | Why | Ripple |
|---|---|---|
| `singleton boolean primary key check (singleton)` | Guarantees exactly one addressable configuration record without magic IDs or an arbitrary JSON blob. | Admin UI loads and updates one row; seed uses `ON CONFLICT DO NOTHING`. |
| Typed columns and database checks | Prevents invalid cities, country/locale/currency drift, invalid duration, or accidental blank platform identity. | Form validation mirrors—not replaces—database validation. |
| No secrets | API keys, service-role credentials, database URLs, and raw environment variables do not belong in Admin. | They remain deployment/secret-manager configuration. |
| Admin-only RLS | Visibility is authorization, not a hidden sidebar link. | A dedicated `is_platform_admin()` predicate protects select/update. |
| Separate behavior-enforcement SQL | A toggle that only changes a row is misleading. | Submission policies query secure boolean helpers; legacy `events` visitor insert is removed. |
| Static SEO/brand assets stay deployment-managed | The application is static; the current `<head>` cannot react to a database setting. | No false “indexing”, canonical, logo, or social-card controls in this phase. |

The stored initial values are platform identity, common event defaults, and the two real submission gates:

```text
platform_name, public_site_url, support_email
default_city, default_country_code, default_timezone,
default_locale, default_currency_code, default_event_duration_minutes
allow_public_event_suggestions, allow_registered_user_submissions
updated_by, updated_at
```

`event_type` remains the existing controlled direct event field. It is neither a platform preference nor a free-form taxonomy setting.

## 4. Information architecture and navigation

The page uses a fixed desktop section navigation inside one settings workspace. It does not use a secondary global sidebar or separate routes for each small form.

```text
/admin/settings
  General
  Event defaults
  Submissions & moderation
  Organizer settings
  Branding
  SEO & sharing
  Localization
  Notifications
  Advanced
```

Only the first three are actionable in this phase. The other labels appear only as short, explicit boundary cards when there is useful explanatory context; they never expose disabled form controls or `Coming soon` buttons. This preserves the requested information architecture without implying unavailable configuration exists.

**Admin navigation:** replace the current disabled `Settings` sidebar item with `/admin/settings`. `RequireAdmin` protects the route. A moderator’s navigation has no Settings entry and direct navigation is denied by the route guard and RLS.

## 5. General settings

**Purpose:** the recognizable platform identity and public address used by future runtime consumers—not an editor for deployment metadata.

| Field | UI and validation | Current effect / boundary |
|---|---|---|
| Platform name | Required text, 2–80 characters. | Future application copy can read it; it does not retroactively rewrite static `index.html`. |
| Public site URL | Required HTTPS URL, no path normalization on every keystroke. | Source for runtime links. Static canonical/schema remain deployment-managed. |
| Support email | Required email field. | Source for future operational copy; existing public contact remains unchanged until explicitly wired. |

One **Save General settings** button saves this cohesive group. A concise “Last changed [time] by [admin]” line sits below the action after a successful save.

## 6. Event defaults

Defaults reduce repetitive admin event entry. They are defaults only: the editor keeps explicit per-event fields authoritative.

| Field | Control | Rule |
|---|---|---|
| Default city | Select: Boston / New York City. | Matches the existing `City` union. |
| Default country | Read-only `United States (US)`. | No editable world-region switch until city/venue support is expanded. |
| Default time zone | Read-only `America/New_York`. | Boston and NYC currently share it; event timestamps remain zone-aware. |
| Default locale | Read-only `English (United States)`. | Translation management is not part of this phase. |
| Default currency | Read-only `USD`. | Event pricing remains individual event data. |
| Default event duration | Number input in 30-minute increments, range 30 minutes–12 hours. | Applies only when a new event form has an end/duration concept; never changes existing events. |

This section uses **Save event defaults**. It does not add configurable default event status, visibility, recurring behavior, or event type: submission status must stay server-enforced `pending`, and those choices have materially different workflow semantics.

## 7. Submissions & moderation

### 7.1 Controls

Two independently enforced policy rows are presented in a high-salience `Submission access` card:

| Control | Copy | Enforcement |
|---|---|---|
| Public event suggestions | “Allow guests and magic-link submitters to suggest an event.” | Anonymous RLS insert on `event_submissions`. |
| Registered-user submissions | “Allow signed-in active users to submit an event.” | Authenticated RLS insert on `event_submissions`, still requiring `account_is_active(auth.uid())`. |

Current status appears as `Accepting submissions` only when either path is on, otherwise `Submissions closed`. Each switch has a plain-language helper and a visible “Applies immediately after confirmation” label.

**Not configurable:** the default submission status remains `pending`; email verification is an Auth/deployment concern; moderator review, duplicate detection, and no-delete submission history retain the existing Phase 7 model.

### 7.2 Safeguards

Turning a path **off** opens a confirmation dialog, not an instant switch:

```text
Disable public event suggestions?
Visitors and magic-link submitters will no longer be able to submit events.
Registered-user submissions remain enabled.

[Cancel] [Disable public suggestions]
```

The dialog names the affected audience, preserves the other path’s state, focuses the Cancel action first, and returns focus to the initiating switch. Re-enabling asks for a lighter confirmation (“Enable…?”) because it reopens an externally reachable write path. Every change records an audit event with changed field names—not values.

The matching public form must render a friendly closed-state message and no submit action. The database remains authoritative when stale tabs, scripts, or a direct API caller attempt an insert.

## 8. Organizer settings

No Organizer setting is actionable now. Administrator approval for organizer privilege remains the current permission model; there is no verified applicant-facing policy/migration in this repository that a switch can safely govern.

Do **not** introduce an `allow_organizer_applications` column, disabled toggle, or a direct-publishing switch. The latter would silently change authorization and bypass review. When a real application flow exists, it needs a separate product decision, RLS enforcement, audit event, and explicit notification plan.

## 9. Branding

No Branding form is introduced. Logo, app icon, accent tokens, and default social imagery are assets/build configuration today. A database form would falsely promise instant propagation across a static build.

The dashboard’s Light/Dark/System choice stays a per-user appearance preference; it is not a platform branding control. This keeps the existing theme system independent from a later brand-token strategy.

## 10. SEO & sharing

No editable title, description, canonical URL, robots, sitemap, structured-data template, social-card, or “disable indexing” control is introduced.

Changing those through a generic settings row cannot change `index.html`, public route metadata, static sitemaps, or crawlable output. A future SEO phase may define an application-level metadata layer; only then may it decide which business defaults belong in `platform_settings`. A global indexing kill switch is deliberately avoided: its blast radius and recovery requirements are disproportionate to this admin surface.

## 11. Localization

The Event defaults card makes the currently fixed regional baseline visible: Boston or NYC, US, English (United States), USD, and America/New_York. Read-only values distinguish present capability from a promise of global configuration.

Multi-language labels, locale fallback, region-specific currency, and arbitrary IANA time zones are later work. They require event/venue regional semantics, translation content, display-format rules, and public SEO decisions—not an unconstrained select in Settings.

## 12. Notifications recommendation

Do not add platform notification controls without delivery infrastructure and a defined recipient model. Distinguish these future concerns:

- **Platform behavior:** should a recipient type be notified at all; potentially a future platform setting.
- **Individual preferences:** how one administrator receives notifications; belongs to that user’s profile.

The needed events already provide a future starting point—new submission, organizer request, approval/rejection—but no control is rendered now. A dead checkbox that cannot actually send email is worse than omission.

## 13. Advanced-settings boundary

Advanced is an explanatory boundary, not a configuration section. It must never expose:

- Supabase service-role or anon keys, database URLs, API keys, webhook signing secrets, or raw environment variables.
- RLS policy text, SQL execution, redirect tables, sitemap routing, or structured-data templates.
- Auth provider/email-verification configuration.
- Per-user notification preferences or irreversible maintenance tasks.

Those belong to deployment configuration, a secret manager, the database review workflow, or their dedicated future product area.

## 14. Save, unsaved, loading, success, and error behavior

- Each multi-field card saves independently; there is no page-wide Save that writes unrelated fields.
- A dirty card shows `Unsaved changes` plus **Discard changes**. Navigating away from dirty state prompts only when the change has not been saved.
- Submit buttons become busy, retain their dimensions, and disable duplicate submission. Other cards remain readable; unrelated saves are not blocked.
- Initial loading uses card-sized skeletons. One failed section retains all successfully loaded sections and offers **Try again** in place.
- Server validation maps to the specific field. Authorization or RLS failure says “Your changes were not saved. Your access may have changed; refresh and try again.” It never claims success optimistically.
- A successful save announces “General settings saved” or “Public event suggestions disabled” via a polite live region and updates the change context.

## 15. Responsive, theme, and accessibility behavior

| Viewport | Layout |
|---|---|
| Desktop (≥1024px) | Section navigation on the left; readable single-column cards in the content area; save action at each card end. |
| Tablet (768–1023px) | Section navigation becomes a horizontally scrollable anchor bar; cards remain one column. |
| Mobile (<768px) | Stacked cards. Section navigation becomes a native select/anchor jump list; no two-column forms or clipped switches. |

All controls have visible labels; status never relies solely on color; helper text has sufficient contrast in Light/Dark/System modes; keyboard focus is obvious; confirmation dialogs trap and return focus; switches expose on/off state semantically; change context is textual; and touch targets meet the dashboard’s existing control sizing.

## 16. Database recommendation: typed singleton versus key/value

| Criterion | Typed singleton (recommended) | Generic key/value (rejected) |
|---|---|---|
| Validation | Database types and explicit constraints. | Runtime parsing and scattered validation. |
| Discoverability | One schema documents supported platform behavior. | Any typo becomes a new configuration surface. |
| Auditability | Changed fields are identifiable and stable. | Values/types need interpretation after the fact. |
| Migration safety | Deliberate additive column migrations. | Values silently change type/meaning over time. |
| Secrets separation | No generic bucket encourages secret storage. | A tempting but unsafe dumping ground. |

The singleton contains no authorization role model, user preferences, taxonomy data, feature flags, UI experiments, or opaque JSON.

## 17. Database recommendations

### Recommended now

1. Create `platform_settings` with one typed singleton and initial audited values.
2. Add database constraints for the presently supported city/region/time-zone/locale/currency domain and duration range.
3. Restrict read/update to admins with RLS; retain service/SQL ownership outside the dashboard.
4. Remove the legacy direct visitor insertion policy on `events` so Phase 7’s `event_submissions` cutover is real.
5. Enforce the two submission gates in `event_submissions` RLS through security-definer boolean helpers.
6. Record platform-setting updates in `audit_logs` without logging field values.

### Recommended later

- A dedicated organizer-application product flow and its own policy switch only when an applicant surface and RLS contract exist.
- Runtime metadata infrastructure before any business-level SEO/share defaults are stored.
- Multilingual content, multi-region and multi-currency design.
- Individual admin notification preferences after delivery channels exist.
- A limited, audited platform-default brand layer after build/runtime asset delivery is defined.

### Avoid

- Generic key/value or JSON settings store.
- Storing secrets, RLS text, raw environment variables, SQL, or analytics IDs in platform settings.
- A global “disable indexing” switch, automatic redirects, or a settings-based sitemap editor.
- Configurable submission status or direct organizer publishing.
- Controls that save successfully but have no product or database enforcement.

## 18. Manual SQL files, order, and safety

All files are **manual review artifacts** under `sql/phase-11/`; none has been executed.

| Order | File | Purpose | Safety boundary |
|---:|---|---|---|
| 1 | `001_create_platform_settings.sql` | Creates the no-secret, typed singleton table. | Additive only. |
| 2 | `002_add_platform_settings_constraints.sql` | Adds checks, admin RLS, and ownership/updated timestamp trigger. | Run only after reviewing the existing admin role claim contract. |
| 3 | `003_seed_platform_settings_defaults.sql` | Inserts SalsaSegura’s current reviewed defaults once. | `ON CONFLICT DO NOTHING`; review values before production. |
| 4 | `004_add_platform_settings_audit.sql` | Records changed setting keys in the existing audit table. | Requires the established audit-log migration. |
| 5 | `005_enforce_submission_settings.sql` | Cuts off legacy direct visitor event insert and makes `event_submissions` RLS consult the two settings. | Run with the UI release that hides closed submission paths and shows the closed-state message. |

**Operational checks before 005:** confirm `001`–`004` completed, the singleton row exists, current desired values are reviewed, the public form release is deployed, and admin direct event creation still passes its existing RLS policy. Test anonymous and authenticated submission both enabled, then disable each separately and confirm the appropriate database insert is rejected. Restore the approved production policy after testing.

`005` is deliberately not a destructive table migration, but it changes externally reachable write authorization. Do not execute it as a background deploy step or while an older frontend still advertises a submission path that the policy will reject.

## 19. Compact wireframe

```text
+----------------------+--------------------------------------------------+
| ADMIN                | Settings                                         |
| Dashboard             | Configure SalsaSegura platform behavior          |
| Events                |                                                  |
| Users                 |  [General] [Event defaults] [Submissions]       |
| Event Submissions     |                                                  |
| Organizer Requests    |  GENERAL                                         |
| Venues                |  Platform name       [ Salsa Segura             ]|
| Tags                  |  Public site URL      [ https://salsasegura.com ]|
|                      |  Support email        [ info@salsasegura.com   ]|
| SYSTEM                |                         [Save General settings]  |
| Settings              |  Last changed Aug 15 by Admin                    |
|                      |--------------------------------------------------|
|                      |  EVENT DEFAULTS                                  |
|                      |  Default city        [ Boston v ]                |
|                      |  Time zone           America/New_York (fixed)    |
|                      |  Default duration    [ 180 ] minutes             |
|                      |                         [Save event defaults]     |
|                      |--------------------------------------------------|
|                      |  SUBMISSION ACCESS                               |
|                      |  Public suggestions                  [ ON ]      |
|                      |  Guests and magic-link submitters may suggest.   |
|                      |  Registered-user submissions          [ ON ]      |
|                      |  Active signed-in users may submit.              |
|                      |                                                  |
|                      |  Organizer / Branding / SEO / Notifications      |
|                      |  Not surfaced until a real enforceable contract. |
+----------------------+--------------------------------------------------+
```

## 20. What this phase does not decide

- Audit Log browsing, Analytics, or a system-administration console.
- Organizer application product policy, direct publishing, or notification delivery.
- Static-site metadata implementation, public SEO pages, sitemap policy, redirects, or dynamic social cards.
- Translation management, multi-time-zone events, or global commerce settings.
- Secret storage or execution of manual SQL against production.
