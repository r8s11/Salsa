# Admin Event Quick Flyer Upload — Audit & Implementation Plan

## Phase 1: Codebase Audit (via graft)

- AdminEventsPage — how events list renders, action menu, state refresh
- AdminEventsTable — how actions dispatch, row state
- eventFlyers.ts — uploadEventFlyer, removeEventFlyer, validateEventFlyer signatures
- eventsRepo — updateEventFlyer (or equivalent), actorId sourcing
- Auth context — how current user ID is obtained
- AdminActionMenu — existing menu structure

## Phase 2: Implementation

- Add quick flyer actions to AdminActionMenu
- Single hidden file input
- FlyerTarget state
- updateEventFlyer repository method
- Upload flow, replace flow, remove flow
- Row-scoped busy/error state
- Owner ID bug fix in existing editor

## Phase 3: Tests

- Upload new flyer
- Replace flyer
- DB failure after upload
- Upload failure
- Remove flyer
- Remove DB failure
- Invalid MIME
- File too large
- Admin owns new object path
- Event field isolation
- Row isolation
- Same file reselection
- User cancels picker
- Full editor regression
