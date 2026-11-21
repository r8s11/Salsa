# Plan: signed-in users publish events without waiting for approval

Status: built. Database changes are applied and the switch is on in production (2026-11-21); migration `20261121012558_fix_member_auto_publish_guard.sql` fixed a production-only conflict with `guard_submitter_submission_update()`. Record and rollout steps: [improvements tracker item 13](../user-guides/improvements.md#13-p2--let-signed-in-members-publish-their-own-events). Update user guides and marketing only after a real member publish is verified on the deployed site.

## Current behaviour (verified 2026-11-20)

- Every submission, guest or signed-in, is inserted into `event_submissions` with `status = 'pending'`. RLS enforces it: `supabase/migrations/20260817000000_event_submissions.sql:137-155` ("Authenticated users can submit", "Anon can submit").
- Only a moderator can turn a submission into an event, via `public.approve_event_submission(uuid, uuid[])`. It raises `Moderator role required` for anyone else (`20260929000000_flyer_entity_foundation.sql:1736-1752`; later redefined by `20261024120000`, `20261025000000`, `20261025120000`, `20261028120200`).
- The client (`src/features/submit-event/hooks/useSubmitEventForm.ts` `handleSubmit`) calls `createSubmission` and shows a "submitted, not yet published" confirmation.

## Target behaviour

| Submitter | Result |
| --- | --- |
| Guest (signed out) | Unchanged: `pending`, moderator review. |
| Signed-in, active account, **verified email**, eligible single event, under the limit, feature enabled | Event is published immediately (`events.status = 'approved'`). The submission row is recorded as `approved` and linked to the event. |
| Signed-in but ineligible, or feature disabled | Falls back to `pending` review if the submission was accepted. The user is told why; existing restrictions on account submission still apply. |

Pilot: up to 3 successful auto-publishes per account per rolling 24 hours. Recurring series stay in review.

Admins can unpublish an auto-published event afterwards (post-moderation).

Decision (user, 2026-11-20): trust = active account + verified email + per-account daily rate limit + admin takedown. Rejected: every signed-in account with no checks (free accounts make spam trivial); earned trust only after a first approved event.

## Design

1. **New security-definer RPC `public.publish_own_event_submission(p_submission_id uuid)`**, migration `supabase/migrations/2026112xxxxxxx_registered_event_auto_publish.sql`.
   - Authorization: require `auth.uid()` to match the row's `submitter_id`; reject unauthenticated or non-owner requests without disclosing another user's submission state. Do not widen direct write permissions.
   - Eligibility for a new publish: flag enabled, `account_is_active(auth.uid())`, `auth.users.email_confirmed_at is not null`, submission still `pending`, single event, and fewer than 3 successful auto-publishes in the preceding 24 hours. Takedowns do not restore quota.
   - Enforce one event per submission in the database across both publish paths. Serialize auto-publish per account for quota enforcement and coordinate both paths on the submission row. Check eligibility and quota, create the event, and mark/link the submission in one transaction. After authorization, a retry returns the existing event and its current status without another insert, quota charge, or notification; an archived event is never resurrected.
   - Extract the materialisation logic from the latest migrated `approve_event_submission` definition (event types, multiple flyers, NYC sublocations, neighborhoods), not the 0929 file. Both RPCs reuse the helper; it must not be executable by client roles. Preserve moderator approval behaviour.
   - `source_type = 'user_submission'` (already allowed by `events_status_check` and `events_source_type_check`).
   - **Public listing validation:** validate required fields, dates, and public-facing links server-side. If the listing cannot safely render and make sense without venue or organizer links, leave it in review.
   - **Entity links:** approval only trusts `moderator_entity_review`. Auto-publish must **not** create or link venues or organizers from the submitter's `entity_review`. Publish with no entity links, and queue the suggestion for a moderator to confirm later.
   - **Taxonomy:** moderators pass `p_taxonomy_term_ids`. Auto-publish maps the submitted `dance_styles`/`event_types` to active `taxonomy_terms` ids server-side. Unknown values are dropped, never created.
   - For an authorized submission that remains pending after an eligibility check, return `{published: false, reason}` for normal review. Do not turn authorization failures or unknown outcomes into review confirmations.
2. **Client:** keep the button neutral ("Submit event"). After `createSubmission` succeeds for a signed-in user, call the RPC. Show "Published. View event" or "Sent for review: <reason>" based on the saved result. If the response is lost, check saved status before confirming; if status cannot be verified, say so and do not create another submission. Guest flow is unchanged.
3. **Moderation after publishing:** require an admin queue filter "Auto-published, last 7 days" and an admin-only Unpublish action before enabling the pilot. Set `events.status = 'archived'` for takedown; reserve `cancelled` for real event cancellations. Archived events must disappear from public search, calendars, and detail pages. Use the existing audit mechanism to record publish and takedown, including actor, time, reason, and linked submission/event IDs.
4. **Email:** send `notifySubmissionReceived` (`send-submission-email`) based on the committed result: review receipt for pending submissions; published variant and moderator FYI for auto-published events. Retries must not resend the notification.
5. **Kill switch:** `platform_settings.registered_auto_publish_enabled` (default off). An admin enables it only after verification passes. Turning it off prevents new auto-publishes; it does not hide existing events.

## Docs and marketing to update after enablement

- `docs/user-guides/dancers.md` "Suggest an event" and status table; `organizers.md` "Choose the right event workflow"; `venues.md` "Promote events you organize" ("does not bypass review"); `README.md` if it mentions review. Keep `src/features/help/guideIntegrity.test.tsx` passing.
- In-app `ContextHelp` copy for surface `submit`.
- `marketing/instagram/guides-carousel/` slides 3 and 8 plus `caption.md`: use "Eligible signed-in accounts can publish immediately. Guest submissions are reviewed first." Hold updates until the feature is live and enabled.

## Verification

- Database tests: eligible → one approved linked event; unverified, inactive, recurring, invalid, or over-limit → no auto-publish. Flag off → normal review, with existing public events unchanged. Guests keep the existing path. Non-owners cannot publish another user's submission; clients cannot call the internal helper. Submitter `entity_review` creates no venue or organizer links.
- Concurrency and retry tests: simultaneous submissions at the quota boundary stay within the cap; retrying the same submission returns the same event; moderator approval racing auto-publish creates at most one event. A failed transaction leaves no partial event, approval, or quota charge.
- Client and email tests: published versus review confirmation and notification; lost response and status recovery; retries do not duplicate notifications.
- Browser smoke on `/submit`, signed in and signed out. Verify moderator takedown hides the listing from public search, calendars, and direct detail pages and leaves an audit record. Do not enable the pilot until these checks pass.
