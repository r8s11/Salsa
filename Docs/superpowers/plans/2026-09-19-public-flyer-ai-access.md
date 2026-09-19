# Public Flyer Upload and AI Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anonymous and authenticated visitors upload event flyers while keeping AI extraction authenticated-only and repairing the live Storage policy.

**Architecture:** Reuse the existing `event-flyers` bucket and `uploadEventFlyer` helper. Anonymous submissions use the existing path builder with `ownerId: "anonymous"`; authenticated submissions keep user-id ownership. A narrow Storage RLS migration grants anon INSERT/DELETE only under the `anonymous/` prefix. The UI always renders `EventFlyerField`; authenticated users retain extraction, anonymous users get a sign-in gate that never invokes the Edge Function.

**Tech Stack:** React 19, TypeScript, Supabase JS Storage, Postgres Storage RLS, Vitest, Testing Library.

**Spec:** `Docs/superpowers/specs/2026-09-13-public-flyer-ai-access-design.md`

## Global Constraints

- JPEG, PNG, WebP only; maximum 5 MiB.
- Existing authenticated owner/admin policies stay unchanged.
- No database table, moderation, submission-eligibility, prompt, provider, extraction-schema, or auth-callback changes.
- Anonymous upload failures remain non-blocking.
- Production SQL is prepared and verified locally; applying it to the live project requires point-of-risk user confirmation.
- Docker-dependent commands are prohibited on this workstation.

---

### Task 1: Anonymous Storage Policy

**Files:**

- Create: `supabase/migrations/<generated>_public_event_flyer_uploads.sql`
- Create: `sql/2026-09-19_public_event_flyer_uploads.sql`

**Interfaces:**

- Consumes: bucket `event-flyers`; path prefix `anonymous/`.
- Produces: anon INSERT and DELETE permission limited to `bucket_id = 'event-flyers'` and `(storage.foldername(name))[1] = 'anonymous'`.

- [ ] **Step 1: Generate the imperative migration filename**

Run `npx supabase migration new public_event_flyer_uploads`; do not invent the timestamp.

- [ ] **Step 2: Write the policy SQL**

Both files must be idempotent and contain equivalent policy definitions:

```sql
drop policy if exists "Anonymous visitors insert event flyers" on storage.objects;
create policy "Anonymous visitors insert event flyers"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'event-flyers'
  and (storage.foldername(name))[1] = 'anonymous'
);

drop policy if exists "Anonymous visitors delete event flyers" on storage.objects;
create policy "Anonymous visitors delete event flyers"
on storage.objects
for delete
to anon
using (
  bucket_id = 'event-flyers'
  and (storage.foldername(name))[1] = 'anonymous'
);
```

The production script also upserts the bucket with the existing public/read/MIME/5 MiB configuration before the policies. Do not grant anon UPDATE or authenticated access outside existing policies.

- [ ] **Step 3: Verify policy text without Docker**

Run focused static assertions for bucket id, `to anon`, exact `anonymous` prefix, INSERT, DELETE, and absence of anon UPDATE/all policies. Parse/apply against disposable Postgres only if its Storage schema is available; otherwise record that hosted application remains pending confirmation.

### Task 2: Anonymous Flyer Persistence

**Files:**

- Modify: `src/features/submit-event/hooks/useSubmitEventForm.ts:140-168`
- Test: `src/features/submit-event/hooks/useSubmitEventForm.test.ts:299-329`

**Interfaces:**

- Consumes: `uploadEventFlyer({ file, ownerId, eventId })`.
- Produces: anonymous calls use `{ ownerId: "anonymous", eventId: /^submission-/ }`; authenticated calls stay unchanged.

- [ ] **Step 1: Replace the guest no-upload test with a failing anonymous-upload contract**

Assert `uploadEventFlyer` is called once with `ownerId: "anonymous"`, a `submission-*` event id, and the selected file; assert `flyerReady === true` and submission receives `{ image_url: flyerUrl }`.

- [ ] **Step 2: Run the focused test and confirm failure**

Run `npm test -- --run src/features/submit-event/hooks/useSubmitEventForm.test.ts` and expect the anonymous upload assertion to fail because the current hook returns before upload.

- [ ] **Step 3: Implement the minimal namespace change**

Remove the anonymous early return and pass `ownerId: user?.id ?? "anonymous"`. Keep the existing random submission id, retry, replacement cleanup, upload promise, and error behavior.

- [ ] **Step 4: Re-run the focused hook test**

Expect all hook tests to pass.

### Task 3: Anonymous Flyer UI and Authenticated AI Gate

**Files:**

- Modify: `src/pages/SubmitEventPage.tsx:145-183`
- Test: `src/pages/SubmitEventPage.flyer.test.tsx:270-303`

**Interfaces:**

- Consumes: `flyerReady`, `user`, `handleExtractFlyer`.
- Produces: flyer field for every visitor; authenticated extraction button; anonymous sign-in CTA with `target="_blank"` and `rel="noreferrer"`.

- [ ] **Step 1: Write the failing anonymous UI test**

For `mockAuth.user = null`, upload a PNG and assert the flyer field exists, upload uses the anonymous namespace, and the page renders `Extract details with AI` plus a `/signin` link opening a new tab. Assert `extractEventFromFlyer` is never called.

- [ ] **Step 2: Confirm the current test fails**

Run `npm test -- --run src/pages/SubmitEventPage.flyer.test.tsx`.

- [ ] **Step 3: Render flyer upload for everyone and gate AI**

Remove the guest replacement note around `EventFlyerField`. When `flyerReady && extractionStatus === "idle"`, render the existing extraction button only for `user`; otherwise render the specified sign-in copy/link. Never call `handleExtractFlyer` for anonymous visitors.

- [ ] **Step 4: Re-run page and hook tests**

Run both focused suites and require a clean pass.

### Task 4: Edge Function Authorization Regression

**Files:**

- Test: `supabase/functions/extract-flyer/index.test.ts`
- Modify only if a real regression is exposed: `supabase/functions/extract-flyer/index.ts`

**Interfaces:**

- Produces: missing, malformed, and invalid bearer credentials return 401 before image fetch/OpenAI work; anonymous-path URLs remain rejected.

- [ ] **Step 1: Add or confirm tests for the four authorization boundaries**

Cover no header, malformed bearer header, invalid token, and authenticated caller attempting an `anonymous/` URL. Each must assert image/provider dependencies were not called.

- [ ] **Step 2: Run the Deno test if Deno is installed**

Run `deno test supabase/functions/extract-flyer/index.test.ts`; otherwise record the unavailable runtime and rely on the unchanged server boundary plus TypeScript tests.

- [ ] **Step 3: Run final focused verification**

Run the two Vitest suites, `npm run lint`, `npm run build`, and the existing Edge Function test where available. Do not apply production SQL yet.
