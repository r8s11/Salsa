# Desk Confirm-Then-Animate Design

## Goal
Preserve the Listings Desk’s existing “Set in place” success moment while preventing a rejected approval request from falsely animating an entry out of the galley.

## Scope
- `src/components/Desk/OperatorDesk.tsx`
- `src/components/Desk/Galley.tsx`
- `src/components/Desk/desk.css`
- Existing component tests, or focused tests added beside the desk components if no covering test exists.

No undo flow, global keyboard-shortcut scheme, copy change, routing change, design-token change, or visual-world replacement is included.

## Current Behavior
`OperatorDesk.settle()` starts a 420ms leave animation and removes the row before `approveSubmissionWithTaxonomy()` resolves. An error handler restores the row after the request fails. The user therefore sees an unconfirmed entry leave and then reappear with an inline error.

## Decision
Use a **confirm-then-animate** sequence.

1. The moderator chooses Approve from an open galley entry.
2. Existing busy state disables all decision controls while the request is pending.
3. The entry remains visibly open in the galley during the request; its context and focused control stay present.
4. On server success, run the existing 420ms leave animation. At the end, remove the entry from the galley, add its optimistic listing to the correct fixed week division, and pulse the work count.
5. After a successful removal, focus the next unresolved galley entry’s title. If no unresolved entry remains, focus the galley’s empty status message.
6. On server error, the entry never departs. Keep it open, retain focus in its context, and show the existing inline `DeskError`.

## Interaction Invariants
- Approval still does not route, toast, or ask for confirmation.
- Reject continues to use the existing protected-focus reason dialog.
- The success motion remains the only authored movement in this decision path; failure is quiet because no false movement occurred.
- A focus move happens only after a successful decision removes the currently focused controls.
- The state palette, agate scale, 34px control floor, margin marks, rules-not-cards layout, and responsive stacking behavior remain unchanged.

## Data and Component Boundaries
`OperatorDesk` owns mutation lifecycle and the settled listing that appears in the week. `Galley` owns which entry is open and which stable destination can receive focus after a successful removal. It exposes a narrow success signal/callback or receives a decision-completion prop; it does not own mutation state.

Focus targets use actual semantic elements: the next `DeskEntry` title button, or a focusable galley empty-status element. No document query by copy text and no global keyboard shortcut listener.

## Error Handling
A failed approval must leave all three visible facts coherent:
- the galley row is still present and expanded;
- it was never inserted into the week;
- the inline error names the failure and is associated with the decision area.

## Test Plan
1. A focused component test proves an approval failure leaves the galley entry rendered and expanded, shows the error, and does not produce a leaving state or weekly insertion.
2. A focused component test proves a successful approval still leaves, appears in the week, and places focus on the next unresolved entry.
3. A final browser pass exercises desktop and mobile geometry against a reachable fixture or authenticated operator session. If neither exists, report the concrete access blocker rather than claiming visual verification.

## Spec Review
- No placeholders or deferred decisions.
- One narrow interaction path; no unrelated critique findings included.
- Component ownership is explicit: mutation lifecycle in `OperatorDesk`, local open/focus destination in `Galley`.
- Success, failure, focus, and empty-queue behavior are all specified.