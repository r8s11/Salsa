# Organizer Event Editing and Homepage Modal Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep homepage event details on the homepage, add safe flyer replacement to the existing pending/rejected owner editor and admin event editor, and tighten the named event surfaces without changing the review workflow.

**Architecture:** Homepage card selection becomes callback-driven local state in `Events`, reusing `EventModal` while Calendar remains query-string driven. A focused `eventFlyers` storage repository handles file validation, scoped paths, upload, public URLs, and safe deletion; `EventFlyerField` owns only the accessible controlled file/preview UI. The owner editor retains the current direct event-update/RLS boundary—pending/rejected only—and the SQL creates Storage infrastructure without changing events table schema or RLS.

**Tech Stack:** React 19, TypeScript strict mode, React Router v7 classic routes, TanStack Query v5, Supabase JS Storage/PostgREST, Vitest, React Testing Library, CSS custom properties.

## Global Constraints

- Preserve the current pending/rejected-only owner-edit gate; approved events remain read-only and publicly stable.
- Preserve calendar query-string modal behavior, map links, social/contact links, Add to Calendar, authentication, and admin/moderator management paths.
- Reuse `events.image_url`; do not add an event table column or a second event form flow.
- Store flyer objects only in the public `event-flyers` bucket and never execute production SQL automatically.
- Allow only `image/jpeg`, `image/png`, and `image/webp`, each at most 5 MiB.
- Delete an old asset only when it is demonstrably an `event-flyers` public URL; never delete an external legacy image URL.
- Use existing Ritmo Vivo semantic tokens; no hard-coded colors, new visual world, or arbitrary negative margins.
- Keep all layout changes responsive at narrow mobile widths and preserve visible focus affordances.
- Run Prettier rather than manually formatting markup.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/features/events/api/eventFlyers.ts` | Validates image files, uploads/removes Storage objects, derives safe bucket paths. |
| `src/features/events/api/eventFlyers.test.ts` | Proves supported-file validation, upload error handling, public URL retrieval, and safe removal boundaries. |
| `src/features/events/components/EventFlyerField.tsx` | Controlled file selector, current/new preview, validation feedback, and object-URL cleanup. |
| `src/features/events/components/EventFlyerField.test.tsx` | Proves label association, invalid-file rejection, preview, and replacement selection. |
| `src/pages/UserEventEditPage.tsx` | Adds flyer state to the existing pending/rejected owner-save flow and retains edit authorization. |
| `src/pages/UserEventEditPage.test.tsx` | Proves owner persistence includes the uploaded URL, errors remain actionable, and approved edit redirects remain intact. |
| `src/components/Admin/AdminEventForm.tsx` | Reuses flyer field when editing an existing admin event; keeps URL behavior available for new-event creation. |
| `src/pages/AdminEventsPage.tsx` | Supplies existing event ID/owner identity to the admin form’s uploader and persists the resolved image URL. |
| `src/components/Events/{Events,EventCard,FeaturedEventCard}.tsx` | Replaces homepage navigation with callback-driven modal selection. |
| `src/components/Events/*test.tsx` | Proves click and keyboard selection callback behavior without routing. |
| `src/components/Events/Events.css` | Removes artificial card title/metadata separation. |
| `src/components/EventModal/EventModal.css` | Compacts metadata hierarchy and supports natural long-address wrapping. |
| `src/components/Admin/AdminSidebar.tsx` | Makes admin brand link to public `/`. |
| `sql/2026-08-21_event_flyers_storage.sql` | Manually applied public bucket and Storage RLS policies only. |

### Task 1: Add isolated flyer storage API and reviewed SQL

**Files:**
- Create: `src/features/events/api/eventFlyers.ts`
- Create: `src/features/events/api/eventFlyers.test.ts`
- Create: `sql/2026-08-21_event_flyers_storage.sql`

**Interfaces:**
- Produces: `EVENT_FLYERS_BUCKET`, `MAX_EVENT_FLYER_BYTES`, `validateEventFlyer(file: File): string | null`, `uploadEventFlyer(input: { file: File; ownerId: string; eventId: string }): Promise<{ url: string; path: string }>`, `removeEventFlyer(url: string): Promise<void>`.
- Consumes: existing `supabase` client from `src/lib/supabase.ts`.

- [ ] **Step 1: Write failing repository tests**

```ts
it("rejects non-image and oversized flyer files", () => {
  expect(validateEventFlyer(new File(["x"], "poster.gif", { type: "image/gif" })))
    .toMatch(/JPEG, PNG, or WebP/i);
  expect(validateEventFlyer(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "poster.png", { type: "image/png" })))
    .toMatch(/5 MB/i);
});

it("uploads a supported flyer with its MIME type and returns its public URL", async () => {
  mocks.upload.mockResolvedValue({ error: null });
  mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: "https://project.supabase.co/storage/v1/object/public/event-flyers/user-1/event-1/id.png" } });
  await expect(uploadEventFlyer({ file: pngFile, ownerId: "user-1", eventId: "event-1" })).resolves.toMatchObject({ url: expect.stringContaining("event-flyers") });
  expect(mocks.upload).toHaveBeenCalledWith(expect.stringMatching(/^user-1\/event-1\//), pngFile, { contentType: "image/png", upsert: false });
});

it("does not remove an external image URL", async () => {
  await removeEventFlyer("https://example.com/legacy-flyer.jpg");
  expect(mocks.remove).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the repository test to verify it fails**

Run: `npx vitest run src/features/events/api/eventFlyers.test.ts`

Expected: FAIL because `eventFlyers.ts` does not exist.

- [ ] **Step 3: Implement the minimal Storage repository**

```ts
export const EVENT_FLYERS_BUCKET = "event-flyers";
export const MAX_EVENT_FLYER_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateEventFlyer(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type)) return "Choose a JPEG, PNG, or WebP image.";
  if (file.size > MAX_EVENT_FLYER_BYTES) return "Image must be 5 MB or smaller.";
  return null;
}

export async function uploadEventFlyer({ file, ownerId, eventId }: UploadEventFlyerInput) {
  const errorMessage = validateEventFlyer(file);
  if (errorMessage) throw new Error(errorMessage);
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${ownerId}/${eventId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(EVENT_FLYERS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return { path, url: supabase.storage.from(EVENT_FLYERS_BUCKET).getPublicUrl(path).data.publicUrl };
}
```

Implement `removeEventFlyer` by parsing only URLs under this project’s `/storage/v1/object/public/event-flyers/` prefix, decoding the path after the bucket segment, and returning without calling Storage for any other URL. Propagate Storage removal errors.

- [ ] **Step 4: Create the manually applied SQL file**

Include idempotent bucket configuration and policies with these operational invariants:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-flyers', 'event-flyers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners upload event flyers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-flyers'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

Add idempotent owner-path update/delete policies and parallel admin policies using the project’s existing JWT admin-role convention. Include a comment that this SQL must be manually run in Supabase production and does not change `public.events` policies or event status behavior.

- [ ] **Step 5: Run the focused tests**

Run: `npx vitest run src/features/events/api/eventFlyers.test.ts`

Expected: PASS with Storage client calls asserted and external URLs untouched.

- [ ] **Step 6: Commit**

```bash
git add src/features/events/api/eventFlyers.ts src/features/events/api/eventFlyers.test.ts sql/2026-08-21_event_flyers_storage.sql
git commit -m "feat: add event flyer storage support"
```

### Task 2: Build the reusable controlled flyer field

**Files:**
- Create: `src/features/events/components/EventFlyerField.tsx`
- Create: `src/features/events/components/EventFlyerField.test.tsx`

**Interfaces:**
- Consumes: `validateEventFlyer` from `eventFlyers.ts`.
- Produces: `EventFlyerField({ currentUrl, file, onFileChange, disabled }: { currentUrl: string | null; file: File | null; onFileChange: (file: File | null) => void; disabled?: boolean }): JSX.Element`.

- [ ] **Step 1: Write failing UI tests**

```tsx
it("labels the picker and previews a selected supported image", async () => {
  render(<EventFlyerField currentUrl={null} file={null} onFileChange={onFileChange} />);
  const input = screen.getByLabelText("Event flyer");
  await userEvent.upload(input, new File(["png"], "flyer.png", { type: "image/png" }));
  expect(onFileChange).toHaveBeenCalledWith(expect.objectContaining({ name: "flyer.png" }));
});

it("shows an inline error and does not select an unsupported file", async () => {
  render(<EventFlyerField currentUrl="https://example.com/current.jpg" file={null} onFileChange={onFileChange} />);
  await userEvent.upload(screen.getByLabelText("Event flyer"), new File(["gif"], "flyer.gif", { type: "image/gif" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/JPEG, PNG, or WebP/i);
  expect(onFileChange).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the field test to verify it fails**

Run: `npx vitest run src/features/events/components/EventFlyerField.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement preview lifecycle and accessible feedback**

Render `label htmlFor="event-flyer"`, a `type="file"` input with `accept="image/jpeg,image/png,image/webp"`, the current remote preview when no local file is selected, and an object-URL local preview when a validated file is selected. Create the object URL in an effect and revoke it in the effect cleanup. Use `role="alert"` for validation errors and do not call `onFileChange` for an invalid selection. Disable the input while `disabled` is true.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run src/features/events/components/EventFlyerField.test.tsx`

Expected: PASS with valid selection, validation error, current preview, and disabled behavior covered.

- [ ] **Step 5: Commit**

```bash
git add src/features/events/components/EventFlyerField.tsx src/features/events/components/EventFlyerField.test.tsx
git commit -m "feat: add reusable event flyer field"
```

### Task 3: Wire flyer replacement into pending/rejected owner editing

**Files:**
- Modify: `src/features/events/api/eventsRepo.ts:123-176`
- Modify: `src/pages/UserEventEditPage.tsx:20-238`
- Modify: `src/pages/UserEventEditPage.css:5-31`
- Modify: `src/pages/UserEventEditPage.test.tsx:8-246`

**Interfaces:**
- Consumes: `EventFlyerField`, `uploadEventFlyer`, and `removeEventFlyer` from Tasks 1–2.
- Changes: `UserEventUpdatePayload` gains `image_url?: string | null` while retaining its explicit omission of status, source type, submitter data, host/contact, venue, and gallery.

- [ ] **Step 1: Extend the owner-editor test first**

Add mocks for `uploadEventFlyer` and `removeEventFlyer`, then prove a selected flyer uploads before mutation and its returned URL is persisted:

```tsx
mocks.uploadEventFlyer.mockResolvedValueOnce({ path: "user-1/pending-event-id/new.png", url: "https://cdn.test/new.png" });
await userEvent.upload(screen.getByLabelText("Event flyer"), new File(["png"], "new.png", { type: "image/png" }));
await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
await waitFor(() => expect(mocks.updateEventForUser).toHaveBeenCalledWith(
  "pending-event-id",
  expect.objectContaining({ image_url: "https://cdn.test/new.png" }),
));
```

Also retain the existing approved-event redirect test. Add an upload-rejection test asserting the mutation is not called and an error alert remains visible, and a save-without-replacement test that starts from `image_url: "https://cdn.test/current.png"` and asserts the mutation payload has no `image_url` property.

- [ ] **Step 2: Run the owner-editor test to verify it fails**

Run: `npx vitest run src/pages/UserEventEditPage.test.tsx`

Expected: FAIL because no flyer field/upload behavior exists.

- [ ] **Step 3: Make `image_url` an explicit optional owner-edit patch field**

Add `image_url?: string | null` to `UserEventUpdatePayload`. Build the PostgREST update object from the established user-edit fields, then append `image_url` only when `payload.image_url !== undefined`; this preserves an existing flyer on ordinary non-flyer saves and still permits a future explicit clear (`null`). Do not add status, source, submitter, host, contact, venue, or gallery fields.

- [ ] **Step 4: Add ordered save behavior to `UserEventEditPage`**

Keep `selectedFlyer: File | null` state. After `validateSubmitForm(form)` succeeds, upload a selected file with `ownerId: user.id` and `eventId: editingEvent.id`; only then build the update payload with the returned URL. When no replacement is selected, call the existing payload builder without `image_url`. If the mutation fails after a new upload, best-effort remove the newly uploaded URL and retain the form plus failure message. After successful persistence, remove the previous image only if a replacement occurred and it is a safe bucket URL. Replace the redirect-on-success with a `role="status"` success message so the completed save is visible; retain the existing Cancel route.

- [ ] **Step 5: Run focused editor tests**

Run: `npx vitest run src/pages/UserEventEditPage.test.tsx src/features/events/api/eventsRepo.test.ts`

Expected: PASS, including approved-event rejection/redirect and no protected fields in the outgoing payload.

- [ ] **Step 6: Commit**

```bash
git add src/features/events/api/eventsRepo.ts src/pages/UserEventEditPage.tsx src/pages/UserEventEditPage.css src/pages/UserEventEditPage.test.tsx src/features/events/api/eventsRepo.test.ts
git commit -m "feat: let submitters replace pending event flyers"
```

### Task 4: Reuse flyer replacement in existing admin event editing

**Files:**
- Modify: `src/components/Admin/AdminEventForm.tsx:14-497`
- Modify: `src/components/Admin/AdminEventForm.test.tsx:1-160`
- Modify: `src/pages/AdminEventsPage.tsx:1-515`
- Modify: `src/pages/AdminEventsPage.test.tsx`
- Modify: `src/hooks/useAdminEvents.ts:43-106`

**Interfaces:**
- Consumes: `EventFlyerField`, `uploadEventFlyer`, and `removeEventFlyer`.
- Changes: `AdminEventFormProps` gains optional `eventId?: string` and `onSubmit(form: AdminEventFormValues, flyer: File | null): Promise<void>`.
- Changes: `useAdminEvents()` exposes `saveAsync: saveMutation.mutateAsync` alongside the existing `save` function.

- [ ] **Step 1: Write failing admin-form tests**

```tsx
it("offers flyer replacement for an existing event", () => {
  render(<MemoryRouter><AdminEventForm {...baseProps} eventId="event-1" /></MemoryRouter>);
  expect(screen.getByLabelText("Event flyer")).toBeEnabled();
});

it("passes the selected flyer to the async edit submit handler", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<MemoryRouter><AdminEventForm {...baseProps} eventId="event-1" onSubmit={onSubmit} /></MemoryRouter>);
  await userEvent.upload(screen.getByLabelText("Event flyer"), new File(["png"], "flyer.png", { type: "image/png" }));
  await userEvent.click(screen.getByRole("button", { name: /save event/i }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ name: "flyer.png" })));
});

it("keeps URL entry available when creating a new event", () => {
  render(<MemoryRouter><AdminEventForm {...baseProps} /></MemoryRouter>);
  expect(screen.getByLabelText("Image URL")).toBeInTheDocument();
  expect(screen.queryByLabelText("Event flyer")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the admin form tests to verify failure**

Run: `npx vitest run src/components/Admin/AdminEventForm.test.tsx`

Expected: FAIL because the new props/field and selected-file callback do not exist.

- [ ] **Step 3: Make the form collect, not persist, flyer files**

For existing events, render `EventFlyerField`, retain its `File | null` in `AdminEventForm`, and await `onSubmit(form, selectedFlyer)` only after the existing form validation succeeds. If that promise rejects, render its message through the existing error banner and leave form/file state intact. Keep the URL input for new-event creation because it has no persisted event ID/path yet. The form must not upload or delete Storage objects itself.

- [ ] **Step 4: Persist admin replacements transactionally at the page boundary**

Expose `saveAsync` from `useAdminEvents`. In `AdminEventsPage`, make `submitForm` async. For an existing event with a selected flyer, call `uploadEventFlyer({ file, ownerId: formView.event.submitter_id ?? currentUser.id, eventId: formView.event.id })`, replace `image_url` in `adminFormToPayload(form)`, await `saveAsync({ id, payload })`, then call `removeEventFlyer(formView.event.image_url)` only after the event mutation resolves. If save rejects after upload, best-effort remove only the new uploaded URL, then rethrow so the form’s banner shows the save error. For new events or no selected file, preserve the current save payload and behavior. Obtain `currentUser` from the existing auth context in the page; do not derive it from a form field.

- [ ] **Step 5: Run admin-focused tests**

Run: `npx vitest run src/components/Admin/AdminEventForm.test.tsx src/pages/AdminEventsPage.test.tsx src/hooks/useAdminEvents.test.ts`

Expected: PASS, including existing edit upload, save-before-old-delete ordering, rejected-save cleanup, and unchanged new-event URL behavior.

- [ ] **Step 6: Commit**

```bash
git add src/components/Admin/AdminEventForm.tsx src/components/Admin/AdminEventForm.test.tsx src/pages/AdminEventsPage.tsx src/pages/AdminEventsPage.test.tsx src/hooks/useAdminEvents.ts src/hooks/useAdminEvents.test.ts
git commit -m "feat: support flyer replacement in admin editor"
```

### Task 5: Keep homepage event details on the homepage

**Files:**
- Modify: `src/components/Events/Events.tsx:1-134`
- Modify: `src/components/Events/EventCard.tsx:1-68`
- Modify: `src/components/Events/FeaturedEventCard.tsx:1-67`
- Modify: `src/components/Events/EventCard.test.tsx:1-65`
- Modify: `src/components/Events/FeaturedEventCard.test.tsx:1-58`
- Create: `src/components/Events/Events.test.tsx`

**Interfaces:**
- Changes: `EventCard` and `FeaturedEventCard` accept `onSelect: (event: ScheduleXEvent) => void` and do not call `useNavigate`.
- Produces: `Events` owns `selectedEvent: ScheduleXEvent | null` and renders `EventModal` with `onClose={() => setSelectedEvent(null)}`.

- [ ] **Step 1: Replace route assertions with callback tests**

```tsx
it("selects the event on click and keyboard activation", () => {
  const onSelect = vi.fn();
  render(<EventCard event={baseEvent} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("button"));
  fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
  expect(onSelect).toHaveBeenCalledWith(baseEvent);
  expect(onSelect).toHaveBeenCalledTimes(2);
});
```

In `Events.test.tsx`, mock `useEvents` and `EventModal`, click a card, assert the modal receives that event, invoke its close prop, and assert the selected event becomes null without changing a `MemoryRouter` location initialized to `/`.

- [ ] **Step 2: Run homepage tests to verify failure**

Run: `npx vitest run src/components/Events/EventCard.test.tsx src/components/Events/FeaturedEventCard.test.tsx src/components/Events/Events.test.tsx`

Expected: FAIL because card props and homepage modal state do not exist.

- [ ] **Step 3: Implement callback selection**

Remove `useNavigate` imports and `openDetail` route construction from both card components. Call `onSelect(event)` from click and Enter/Space keyboard handlers. In `Events`, import `EventModal`, add selected-event state, pass `setSelectedEvent` into both cards, and render the modal after the section with a close handler that only clears state.

- [ ] **Step 4: Run homepage and shared-modal tests**

Run: `npx vitest run src/components/Events/EventCard.test.tsx src/components/Events/FeaturedEventCard.test.tsx src/components/Events/Events.test.tsx src/components/EventModal/EventModal.test.tsx src/components/Calendar/Calendar.test.tsx`

Expected: PASS; no test changes Calendar deep-link behavior.

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/Events.tsx src/components/Events/EventCard.tsx src/components/Events/FeaturedEventCard.tsx src/components/Events/EventCard.test.tsx src/components/Events/FeaturedEventCard.test.tsx src/components/Events/Events.test.tsx
git commit -m "fix: keep homepage event details in place"
```

### Task 6: Repair public brand escape and compact event layout

**Files:**
- Modify: `src/components/Admin/AdminSidebar.tsx:1-235`
- Modify: `src/components/Admin/AdminSidebar.test.tsx`
- Modify: `src/components/Events/Events.css:328-360`
- Modify: `src/components/EventModal/EventModal.css:108-161`
- Modify: `src/components/EventModal/EventModal.test.tsx`

**Interfaces:**
- Changes: sidebar brand becomes `Link to="/"`; no admin route contracts change.
- Preserves: `.event-card`, `.event-card-meta`, `.modal-details`, `.meta-row`, `.dance-styles`, `.style-chip`, and `.modal-description` selectors for existing consumers.

- [ ] **Step 1: Add failing brand navigation coverage**

```tsx
renderSidebar();
expect(screen.getByRole("link", { name: /Salsa Segura/i })).toHaveAttribute("href", "/");
```

- [ ] **Step 2: Run sidebar test to verify failure**

Run: `npx vitest run src/components/Admin/AdminSidebar.test.tsx`

Expected: FAIL because the displayed brand is not a link.

- [ ] **Step 3: Implement the small UI changes**

Import `Link` in `AdminSidebar` and wrap the existing logo component without changing the icon/name or sidebar collapse behavior. In `Events.css`, remove `.event-card-meta { margin-top: auto; }` and reduce the body gap from `0.5rem` to `0.35rem`. In `EventModal.css`, reduce row bottom margin from `12px` to `8px`, description top margin from `16px` to `10px`, and chip gap from `6px` to `5px`; add `min-width: 0` and `flex: 1` to the content span in a metadata row so addresses naturally wrap beside a non-shrinking icon. Keep mobile grid collapse unchanged.

- [ ] **Step 4: Run focused tests and format changed TSX/CSS**

Run: `npx vitest run src/components/Admin/AdminSidebar.test.tsx src/components/EventModal/EventModal.test.tsx`

Run: `npx prettier --write src/components/Admin/AdminSidebar.tsx src/components/Events/Events.css src/components/EventModal/EventModal.css`

Expected: tests PASS; formatter changes only presentation.

- [ ] **Step 5: Commit**

```bash
git add src/components/Admin/AdminSidebar.tsx src/components/Admin/AdminSidebar.test.tsx src/components/Events/Events.css src/components/EventModal/EventModal.css
git commit -m "fix: tighten event information layout"
```

### Task 7: Run the user flows and production gates

**Files:**
- Modify only if a verification exposes a source defect: exact affected source/test file.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: verified public homepage, owner editing, admin brand navigation, responsive layout, and production build evidence.

- [ ] **Step 1: Run all directly changed Vitest files**

Run:

```bash
npx vitest run \
  src/features/events/api/eventFlyers.test.ts \
  src/features/events/components/EventFlyerField.test.tsx \
  src/pages/UserEventEditPage.test.tsx \
  src/features/events/api/eventsRepo.test.ts \
  src/components/Admin/AdminEventForm.test.tsx \
  src/pages/AdminEventsPage.test.tsx \
  src/components/Events/EventCard.test.tsx \
  src/components/Events/FeaturedEventCard.test.tsx \
  src/components/Events/Events.test.tsx \
  src/components/EventModal/EventModal.test.tsx \
  src/components/Calendar/Calendar.test.tsx \
  src/components/Admin/AdminSidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Browser-drive public and responsive modal behavior**

Start the local application, open `/`, select a homepage event, assert the modal is visible and the URL remains `/`, close it, then repeat at a narrow mobile viewport. Verify the calendar still opens its query-selected event and that a long venue/location label wraps without overlap.

- [ ] **Step 3: Browser-drive owner and admin navigation behavior**

With an authenticated pending/rejected event owner, open `/profile`, open its event editor, verify prefilled values, choose a flyer, save, reload, and confirm the persisted preview. Verify an approved event redirects/does not expose save controls. From `/admin`, activate the brand and verify the route is `/`.

- [ ] **Step 4: Run project quality gates**

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Expected: all exit successfully with no TypeScript errors.


Do not alter tests or verification commands merely to produce a passing result.
