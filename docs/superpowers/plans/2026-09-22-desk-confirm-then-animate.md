# Desk Confirm-Then-Animate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avoid false “Set in place” departures when approval fails, while retaining the established success movement and preserving a logical focus destination after successful removal.

**Architecture:** `OperatorDesk` owns the approval mutation lifecycle: it starts the successful transition only in the mutation success callback, then commits the galley/week/count state after the existing leave duration. `Galley` owns local open-entry state and accepts an explicit success-completion signal to focus the next title or the focusable empty-status element. The existing visual system and rejection flow remain unchanged.

**Tech Stack:** React 19, TypeScript, TanStack Query mutation callback contract, Vitest, React Testing Library, `@testing-library/user-event`.

## Global Constraints

- Preserve the Listings Desk visual world: no cards, no shadows, rules and measures only.
- Keep the five state colours state-only and retain the current 34px decision-control minimum.
- Approval does not route, toast, or prompt for confirmation; rejection retains `AdminRejectSubmissionDialog`.
- Failure keeps the same galley entry open with the inline `DeskError`; it must not leave or enter the week.
- Use semantic focus targets only; no global `document.querySelector` by text and no global keyboard shortcut listener.
- Salsa is not a git repository; do not create commits.

---

### Task 1: Pin confirm-then-animate behavior with integration tests

**Files:**
- Modify: `src/pages/Admin/AdminOverviewPage.test.tsx:359-376`
- Test: `src/pages/Admin/AdminOverviewPage.test.tsx`

**Interfaces:**
- Consumes: mocked `useAdminSubmissions()` and its `approveSubmissionWithTaxonomy(payload, callbacks)` mutation API.
- Produces: regression coverage proving mutation failure leaves an open galley entry in place, and success removes it only after invoking the supplied success callback.

- [ ] **Step 1: Write the failing failure-path test**

Add after `approves an entry through the real mutation`:

```tsx
it("keeps an approval failure open in the galley without setting it into the week", async () => {
  const user = userEvent.setup();
  let callbacks!: { onSuccess?: () => void; onError?: (error: Error) => void };
  const approveSubmissionWithTaxonomy = vi.fn(
    (_payload, receivedCallbacks) => {
      callbacks = receivedCallbacks;
    }
  );
  vi.mocked(useAdminSubmissions).mockReturnValue({
    ...defaultSubmissionsState,
    submissions: [submission("s-1", "Unset One", 3)],
    approveSubmissionWithTaxonomy,
  });
  renderPage();

  await user.click(within(galley()).getByRole("button", { name: "Unset One" }));
  await user.click(within(galley()).getByRole("button", { name: "Approve" }));
  callbacks.onError?.(new Error("Approval failed"));

  expect(within(galley()).getByRole("button", { name: "Unset One" })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  expect(within(galley()).getByText("Approval failed")).toBeInTheDocument();
  expect(within(column()).queryByText("Unset One")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npm test -- src/pages/Admin/AdminOverviewPage.test.tsx -t "keeps an approval failure"`

Expected: FAIL because the current implementation starts `settle()` before the mutation outcome, makes the entry leave, and only later restores it.

- [ ] **Step 3: Write the failing success/focus test**

Add a test using two fixture submissions and fake timers. Capture mutation callbacks, trigger `onSuccess`, advance exactly `LEAVE_MS`, then assert the first row is gone, it appears in `column()`, and the next unresolved entry title owns focus:

```tsx
expect(within(galley()).queryByRole("button", { name: "Unset One" })).not.toBeInTheDocument();
expect(within(column()).getByText("Unset One")).toBeInTheDocument();
expect(within(galley()).getByRole("button", { name: "Unset Two" })).toHaveFocus();
```

Use `vi.useFakeTimers()`/`vi.runOnlyPendingTimers()` in a scoped `try/finally` that restores real timers, and wrap timer advancement in `act()`.

- [ ] **Step 4: Run the targeted success/focus test to verify it fails**

Run: `npm test -- src/pages/Admin/AdminOverviewPage.test.tsx -t "focuses the next unresolved"`

Expected: FAIL because current `settle()` runs before the supplied `onSuccess` callback and no code restores focus after the removed entry.

---

### Task 2: Move approval transition behind mutation success

**Files:**
- Modify: `src/components/Desk/OperatorDesk.tsx:63-169`
- Test: `src/pages/Admin/AdminOverviewPage.test.tsx`

**Interfaces:**
- Consumes: `approveSubmissionWithTaxonomy` mutation callbacks and `Galley`’s new success-completion notification contract from Task 3.
- Produces: an `onSuccess` callback that invokes the existing leave→week→count flow; an `onError` callback that only records the error.

- [ ] **Step 1: Refactor `settle` into a successful-decision completion path**

Keep `LEAVE_MS`, `leaving`, `decided`, `settledListings`, and `arrivingId`. Make the success callback call `settle(submission, "set")`; remove the unconditional `settle(submission, "set")` after `approveSubmissionWithTaxonomy(...)`.

The failure callback must only set `decideError`:

```tsx
onError: (mutationError: Error) => {
  setDecideError(mutationError.message || "We couldn't approve this entry.");
},
```

It must not delete an entry from `decided` or filter `settledListings`, because no optimistic success state was created.

- [ ] **Step 2: Keep rejection behavior unchanged**

`handleKill` remains on its current optimistic leave path. It already has a protected-focus dialog and is outside the approved polish scope.

- [ ] **Step 3: Run the two Task 1 tests**

Run: `npm test -- src/pages/Admin/AdminOverviewPage.test.tsx -t "keeps an approval failure|focuses the next unresolved"`

Expected: failure-path test passes; focus test still fails until Task 3 wires the focus target.

---

### Task 3: Restore logical focus after a successful galley removal

**Files:**
- Modify: `src/components/Desk/Galley.tsx:21-150`
- Modify: `src/components/Desk/Desk.tsx:305-312`
- Modify: `src/components/Desk/OperatorDesk.tsx:219-236`
- Test: `src/pages/Admin/AdminOverviewPage.test.tsx`

**Interfaces:**
- Consumes: a successful-decision signal emitted after `settle()` removes an entry.
- Produces: focus on the next surviving `DeskEntry` title; otherwise focus on `DeskEmpty` rendered in the Galley.

- [ ] **Step 1: Add a narrow success-completion prop to `Galley`**

Add a prop containing the ID that most recently completed a successful decision, e.g. `settledId?: string | null`. `OperatorDesk` sets it only after the leave timeout commits `decided` and clears it after focus is handled.

- [ ] **Step 2: Use refs and an effect in `Galley`**

Maintain title-button refs keyed by submission ID and an empty-state ref. In an effect responding to `settledId` and the filtered `submissions` list:

```tsx
const next = submissions.find((submission) => submission.id !== settledId);
if (next) titleRefs.current.get(next.id)?.focus();
else emptyRef.current?.focus();
```

Reset `openId` only after a successful settled ID is observed. Do not move focus on `decideError`.

- [ ] **Step 3: Make the galley empty status a valid focus destination**

Extend `DeskEmpty` with optional `tabIndex` and forwarded ref support, or add a focused status wrapper specifically in `Galley`. Keep visible copy unchanged: `Galley is clear. Nothing is waiting on a decision.` The focus destination must be programmatically focusable but not inserted into the normal tab order (`tabIndex={-1}`).

- [ ] **Step 4: Extend `DeskEntry` only as needed to register its title control**

Add an optional title-button ref prop restricted to the `onOpen` button path; do not alter Link-based column/Host entry behavior.

- [ ] **Step 5: Run both targeted tests**

Run: `npm test -- src/pages/Admin/AdminOverviewPage.test.tsx -t "keeps an approval failure|focuses the next unresolved"`

Expected: PASS. The failure test proves no optimistic departure; the success test proves the established motion completes, entry enters the week, and focus moves to the next unresolved row.

---

### Task 4: Verify retained desk behavior and rendered states

**Files:**
- Verify: `src/pages/Admin/AdminOverviewPage.test.tsx`
- Verify: `src/components/Desk/OperatorDesk.tsx`, `src/components/Desk/Galley.tsx`, `src/components/Desk/Desk.tsx`, `src/components/Desk/desk.css`

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: evidence that existing loading, empty, error, host, moderator, and desktop/mobile desk layouts remain intact.

- [ ] **Step 1: Run the entire existing admin overview file**

Run: `npm test -- src/pages/Admin/AdminOverviewPage.test.tsx`

Expected: PASS, including existing role-specific desk, loading, empty-galley, and week-placement tests.

- [ ] **Step 2: Run the project build**

Run: `npm run build`

Expected: TypeScript and Vite production build pass without new warnings or errors.

- [ ] **Step 3: Browser verification in two bounded passes**

Start the Vite server once. Open the actual operator surface with an authenticated fixture if available; otherwise render the desk in the existing isolated component/browser harness. In one inspection round, capture desktop (≥1080px) and mobile (<640px) with: an expanded galley row, approval in flight, approval failure, successful approval, and empty galley. Check focus visibility, 34px controls, no cards/shadows, seven week divisions, motion reduction, and responsive stacking.

- [ ] **Step 4: Run Impeccable detector once after UI edits**

Run: `.claude/skills/impeccable/scripts/impeccable detect --json src/components/Desk/OperatorDesk.tsx src/components/Desk/Galley.tsx src/components/Desk/Desk.tsx`

Expected: report findings if any; fix real defects in one batch, then perform at most one final desktop+mobile inspection round.

- [ ] **Step 5: Close the critique snapshot only when every selected issue is cleared**

Run: `.claude/skills/impeccable/scripts/impeccable critique-storage close "src/components/Admin/PlatformAdminOverview.tsx" "2026-09-22T16-29-53Z__src-components-admin-platformadminoverview-tsx.md"`

Only run this after the P2 approval-failure recovery issue is verified closed. Do not close the snapshot if unrelated P1/P2/P3 backlog entries remain.