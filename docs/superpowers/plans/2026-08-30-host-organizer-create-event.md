# Host Organizer Create Event — Phase 2 Plan

1. Extend host dashboard data composition with `useMyOrganizerEvents`, dedupe by canonical event id, and combine loading/error/retry paths.
2. Harden the create page: active organizer filtering, explicit editor/no-access state, membership query retry, shared validation, canonical organizer payload with dance-style slugs, draft/publish action, and safe post-create flyer warning/cleanup.
3. Keep legacy date/time and manual venue compatibility; document the manual `venue_id` prerequisite without adding absent datetime or venue migrations.
4. Keep draft rows visible and truthful in Host detail; correct new-event shell breadcrumb and landmark structure.
5. Harden organizer RPC authorization for active organizers and non-null ownership while preserving the explicit admin override.
6. Add behavior-focused tests for access, selector, payload/lifecycle, flyer cleanup, draft/warning detail, dashboard dedupe/retry, API wiring, and existing admin/submit contracts.
7. Run focused Vitest, `npm run build`, and `npm run lint`; report SQL as manual/unexecuted and defer Phase 3 organizer editing.
