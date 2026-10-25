# Public Flyer Upload and AI Access Design

**Date:** 2026-09-13
**Status:** Approved for implementation planning

## Goal

Preserve anonymous Event Submission flyer uploads while making AI-powered flyer extraction an authenticated-account benefit. Flyer upload, preview, replacement, removal, manual entry, and anonymous event submission remain public behavior; only the extraction operation requires a valid Supabase user session.

## Existing Flow

`SubmitEventPage` uses `useSubmitEventForm` for flyer state, upload persistence, extraction, and final submission. The existing client upload validator accepts JPEG, PNG, and WebP files up to 5 MiB. The existing `event-flyers` bucket is public-read and owner-scoped for authenticated writes. The client currently skips uploads for anonymous users and hides the flyer field for them.

The `extract-flyer` Edge Function already requires an `Authorization: Bearer` header, validates it through Supabase Auth, and returns `401` before reading the request image or invoking the model. That server-side boundary remains authoritative.

## Authorization Boundary

### Public flyer operations

Anonymous and authenticated visitors may:

- Choose or drop a flyer.
- Receive the existing MIME and size validation.
- Preview the selected image.
- Replace the selected flyer.
- Remove the selected flyer.
- Continue entering event details manually.
- Submit an Event Submission under the existing eligibility and validation rules.

Anonymous objects use an unpredictable `anonymous/<submission-id>/<uuid>.<extension>` storage path. Authenticated objects retain the existing `<user-id>/submission-.../<uuid>.<extension>` path. Both use the existing bucket, limits, MIME restrictions, public URL behavior, and client storage helpers.

Storage policy changes are limited to allowing anonymous insert and cleanup for the `anonymous` path prefix. Authenticated owner and administrator policies remain unchanged. No database table, event schema, moderation policy, or submission eligibility policy changes are included.

### Authenticated AI extraction

Only an authenticated user may invoke `extract-flyer`.

The client invokes the existing function only for authenticated users. Anonymous visitors see the AI action but receive a sign-in/signup link instead of an extraction request. The Edge Function independently requires a bearer token and resolves the caller through Supabase Auth. It does not trust a client-provided user ID, and no service-role key is sent to the browser.

Invalid, missing, or unusable credentials return JSON `401 Unauthorized` before image fetching or model-provider work. The function continues to validate that an authenticated caller may analyze only a flyer URL under that caller's user-scoped path; anonymous-path URLs are not accepted by the extraction endpoint.

## Anonymous AI UX

When an anonymous visitor has successfully uploaded a flyer, render a visible gated control:

- `✨ Extract details with AI`
- `Sign in to automatically extract event details from your flyer.`

The control opens the existing `/signin` flow in a new tab. Keeping the submission tab open preserves the in-memory form draft and uploaded flyer without introducing a second draft-storage protocol or placing contact data in browser storage. Once authentication completes, the original tab can continue with its existing form and auth session, and the authenticated extraction control becomes available.

The anonymous visitor can ignore the AI control and use the same manual Event Submission form. Upload failure remains non-blocking as before.

## Data Flow

1. Anonymous visitor selects a valid flyer.
2. `EventFlyerField` performs the existing local validation and preview.
3. `useSubmitEventForm` persists the file under the `anonymous` path and records its public URL.
4. The page renders the AI control as a gated sign-in/signup link, not an extraction invocation.
5. The visitor can replace/remove the flyer and continue editing manually.
6. The visitor may submit using the existing anonymous contact requirements and submission API.
7. An authenticated visitor follows the existing extraction path. The client sends only the flyer URL; Supabase supplies the user access token to the Edge Function invocation.
8. The Edge Function verifies the token, validates the user-scoped flyer URL, performs extraction, and returns structured data.

## Failure Handling

- Existing client validation messages and upload failure behavior remain unchanged.
- Anonymous extraction never starts a network request from the client.
- Missing, malformed, expired, or invalid extraction credentials return `401`.
- Authenticated extraction errors retain existing controlled `400`, `422`, `502`, and `503` responses.
- Removing or replacing an anonymous flyer performs the existing best-effort storage cleanup through an anonymous-path policy.
- Manual submission remains available regardless of AI availability or upload failure.

## Tests

Add or update focused coverage for:

- Anonymous uploads use the anonymous storage namespace while retaining existing validation.
- Anonymous flyer preview, replacement, removal, and manual submission remain available.
- Anonymous AI controls are visible, link to `/signin`, and do not invoke extraction.
- Authenticated AI controls continue to invoke extraction.
- The extraction Edge Function returns `401` for missing, malformed, and invalid credentials before image/provider work.
- Authenticated extraction still accepts the existing user-scoped URL and returns structured output.
- Existing submission, upload, extraction, and storage-path tests remain green.

## Non-Goals

This design does not change:

- Anonymous Event Submission eligibility.
- Moderation or approval workflow.
- Event Submission email flow.
- Event schema or migrations unrelated to Storage policy.
- Existing flyer MIME restrictions, 5 MiB limit, preview behavior, or public reads.
- Manual event-entry requirements.
- Auth callback semantics or role-based redirects.
- AI prompt, provider, extraction schema, reconciliation, or prefill behavior.
