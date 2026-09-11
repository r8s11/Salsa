# Phase 7 — Event Submission Review Implementation Plan (Part 2: Tasks 26–33)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

This file continues `docs/superpowers/plans/2026-08-12-phase7-event-submission-review.md` (Tasks 1–25). It shares that file's **Goal**, **Architecture**, **Tech Stack**, **Global Constraints**, and **File Structure** sections in full — read them there before starting Task 26. Do not restate or diverge from them here.

---

## Task 26: `AdminSubmissionsFilterDrawer`

**Files:**
- Create: `src/components/Admin/AdminSubmissionsFilterDrawer.tsx`
- Test: `src/components/Admin/AdminSubmissionsFilterDrawer.test.tsx`

**Interfaces:**
- Consumes: `SubmissionFilters` (Task 9), `CITY_LABEL`/`DANCE_STYLES` (existing, from `eventsQuery.ts`, reused).
- Structurally clones `AdminUsersFilterDrawer.tsx` (Tab-cycling focus trap, `EMPTY_FILTERS`/Clear-all/Apply footer — NOT the mount/unmount-restore pattern used by dialogs).
- Produces: `<AdminSubmissionsFilterDrawer open={boolean} filters={SubmissionFilters} onFiltersChange={(f) => void} onClose={() => void} />` — consumed by Task 27.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AdminSubmissionsFilterDrawer from "./AdminSubmissionsFilterDrawer";
import type { SubmissionFilters } from "../../features/submissions/model/submissionsQuery";

const EMPTY: SubmissionFilters = {
  q: "", city: null, style: null, submitterKind: null, status: null,
};

describe("AdminSubmissionsFilterDrawer", () => {
  it("renders city, dance style, submitter kind, and status fields", () => {
    render(<AdminSubmissionsFilterDrawer open filters={EMPTY} onFiltersChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText("City")).toBeInTheDocument();
    expect(screen.getByLabelText("Dance style")).toBeInTheDocument();
    expect(screen.getByLabelText("Account type")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("Clear all resets every field", () => {
    const onFiltersChange = vi.fn();
    render(<AdminSubmissionsFilterDrawer open filters={{ ...EMPTY, city: "boston" }} onFiltersChange={onFiltersChange} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ city: null, style: null, submitterKind: null, status: null }));
  });

  it("renders nothing when closed", () => {
    const { container } = render(<AdminSubmissionsFilterDrawer open={false} filters={EMPTY} onFiltersChange={vi.fn()} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Admin/AdminSubmissionsFilterDrawer.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**, copying `AdminUsersFilterDrawer.tsx`'s exact focus-trap `handleKeyDown` implementation (manual Tab/Shift+Tab cycling, `dialogRef.current?.focus()` on open) verbatim, with 4 fields (city, dance style, account type, status) plus a Clear all / Apply footer identical in structure to `AdminUsersFilterDrawer`'s:

```tsx
import { useEffect, useRef } from "react";
import type { SubmissionFilters } from "../../features/submissions/model/submissionsQuery";
import type { SubmissionStatus } from "../../features/submissions/model/types";
import { CITY_LABEL, DANCE_STYLES } from "../../features/admin/model/eventsQuery";

const EMPTY_FILTERS: Pick<SubmissionFilters, "city" | "style" | "submitterKind" | "status"> = {
  city: null, style: null, submitterKind: null, status: null,
};

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "Pending", in_review: "In Review", needs_information: "Needs Information",
  approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn",
};

const STATUSES = Object.keys(STATUS_LABEL) as SubmissionStatus[];

export default function AdminSubmissionsFilterDrawer({
  open, filters, onFiltersChange, onClose,
}: {
  open: boolean;
  filters: SubmissionFilters;
  onFiltersChange: (filters: SubmissionFilters) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="More filters"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="admin-filter-drawer"
    >
      <div className="admin-field">
        <label htmlFor="submission-filter-city">City</label>
        <select
          id="submission-filter-city"
          value={filters.city ?? ""}
          onChange={(e) => onFiltersChange({ ...filters, city: (e.target.value || null) as SubmissionFilters["city"] })}
        >
          <option value="">Any city</option>
          {Object.entries(CITY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor="submission-filter-style">Dance style</label>
        <select
          id="submission-filter-style"
          value={filters.style ?? ""}
          onChange={(e) => onFiltersChange({ ...filters, style: e.target.value || null })}
        >
          <option value="">Any style</option>
          {DANCE_STYLES.map((style) => (
            <option key={style} value={style}>{style}</option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor="submission-filter-kind">Account type</label>
        <select
          id="submission-filter-kind"
          value={filters.submitterKind ?? ""}
          onChange={(e) => onFiltersChange({ ...filters, submitterKind: (e.target.value || null) as SubmissionFilters["submitterKind"] })}
        >
          <option value="">Any account type</option>
          <option value="profile">Registered</option>
          <option value="guest">Magic-link only</option>
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor="submission-filter-status">Status</label>
        <select
          id="submission-filter-status"
          value={filters.status ?? ""}
          onChange={(e) => onFiltersChange({ ...filters, status: (e.target.value || null) as SubmissionStatus | null })}
        >
          <option value="">Any status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>{STATUS_LABEL[status]}</option>
          ))}
        </select>
      </div>

      <div className="admin-filter-drawer__footer">
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={() => onFiltersChange({ ...filters, ...EMPTY_FILTERS })}
        >
          Clear all
        </button>
        <button type="button" className="admin-btn admin-btn--primary" onClick={onClose}>
          Apply
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Admin/AdminSubmissionsFilterDrawer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Admin/AdminSubmissionsFilterDrawer.tsx src/components/Admin/AdminSubmissionsFilterDrawer.test.tsx
git commit -m "feat: add AdminSubmissionsFilterDrawer"
```

---

## Task 27: `AdminSubmissionsTable` — queue table + mobile card list

**Files:**
- Create: `src/components/Admin/AdminSubmissionsTable.tsx`
- Test: `src/components/Admin/AdminSubmissionsTable.test.tsx`

**Interfaces:**
- Consumes: `SubmissionRow` (Task 4), `effectiveData` (Task 5), `submissionQualityIssues`/`hasRequiredGap`/`SUBMISSION_QUALITY_LABEL` (Task 6), `findDuplicateCandidates` (Task 7), `AdminSubmissionStatusBadge` (Task 18), `AdminQualityBadge` (Task 17, generalized), `AdminUserAvatar`/`displayNameFor` (existing), `AdminActionMenu`/`ActionMenuItem` (existing).
- Produces: `<AdminSubmissionsTable rows={SubmissionRow[]} canonicalEvents={DatabaseEvent[]} submitterFor={(row) => AdminUserRow} onReview={(id) => void} onApprove={(id) => void} onReject={(row) => void} onViewSubmitter={(row) => void} />` (renders both the `<table>` and the `<768px card-list markup, CSS decides which is visible, per `AdminEventsTable`/`AdminUsersTable`'s established dual-render convention) — consumed by Task 29.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AdminSubmissionsTable from "./AdminSubmissionsTable";
import type { SubmissionRow, SubmittedEventData } from "../../features/submissions/model/types";
import type { AdminUserRow } from "../../features/admin/model/usersQuery";

const data: SubmittedEventData = {
  title: "Bachata on the Harbor", description: null, event_type: "social",
  event_date: "2026-08-24", event_time: "18:00:00", location: null, address: null,
  price_type: null, price_amount: null, rsvp_link: null, image_url: null,
  submitter_name: null, submitter_email: "guest@example.com", submitter_id: null,
  dance_styles: null, city: "boston", host: null, recurrence: null,
  gallery: null, contact_email: null, contact_instagram: null, contact_website: null,
};

function row(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
  return {
    id: "sub-1", submitter_id: null, submitter_email: "guest@example.com", submitter_name: null,
    status: "pending", submitted_data: data, edited_data: null,
    submitted_at: "2026-08-12T00:00:00Z", reviewed_by: null, reviewed_at: null,
    rejection_reason: null, rejection_message: null, internal_note: null,
    duplicate_of_event_id: null, dismissed_duplicate_ids: [], approved_event_id: null,
    created_at: "2026-08-12T00:00:00Z", updated_at: "2026-08-12T00:00:00Z", ...overrides,
  };
}

function guestUser(): AdminUserRow {
  return {
    kind: "guest", id: "guest:guest@example.com", user_id: null, email: "guest@example.com",
    display_name: "Guest Submitter", username: null, avatar_url: null, role: null,
    status: "active", status_reason: null, created_at: "2026-08-01T00:00:00Z",
    last_active_at: "2026-08-12T00:00:00Z", contributions: 1, pending_count: 1,
    approved_count: 0, email_confirmed_at: null,
  };
}

describe("AdminSubmissionsTable", () => {
  it("renders the title as a link to the review page", () => {
    render(
      <AdminSubmissionsTable
        rows={[row()]} canonicalEvents={[]} submitterFor={guestUser}
        onReview={vi.fn()} onApprove={vi.fn()} onReject={vi.fn()} onViewSubmitter={vi.fn()}
      />
    );
    expect(screen.getByRole("link", { name: "Bachata on the Harbor" })).toHaveAttribute("href", "/admin/submissions/sub-1");
  });

  it("shows 'No styles listed' when dance_styles is null", () => {
    render(
      <AdminSubmissionsTable
        rows={[row()]} canonicalEvents={[]} submitterFor={guestUser}
        onReview={vi.fn()} onApprove={vi.fn()} onReject={vi.fn()} onViewSubmitter={vi.fn()}
      />
    );
    expect(screen.getByText("No styles listed")).toBeInTheDocument();
  });

  it("shows 'Time TBD' when event_time is null", () => {
    render(
      <AdminSubmissionsTable
        rows={[row()]} canonicalEvents={[]} submitterFor={guestUser}
        onReview={vi.fn()} onApprove={vi.fn()} onReject={vi.fn()} onViewSubmitter={vi.fn()}
      />
    );
    expect(screen.getByText(/Time TBD/)).toBeInTheDocument();
  });

  it("omits Approve from the row action menu when a Required-tier gap exists", () => {
    render(
      <AdminSubmissionsTable
        rows={[row({ submitted_data: { ...data, title: "" } })]} canonicalEvents={[]} submitterFor={guestUser}
        onReview={vi.fn()} onApprove={vi.fn()} onReject={vi.fn()} onViewSubmitter={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    expect(screen.queryByRole("menuitem", { name: "Approve" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Admin/AdminSubmissionsTable.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**

```tsx
import { Link } from "react-router-dom";
import type { SubmissionRow } from "../../features/submissions/model/types";
import type { DatabaseEvent } from "../../features/events/model/types";
import type { AdminUserRow } from "../../features/admin/model/usersQuery";
import { effectiveData } from "../../features/submissions/model/submissionForm";
import { submissionQualityIssues, hasRequiredGap, SUBMISSION_QUALITY_LABEL } from "../../features/submissions/model/quality";
import { findDuplicateCandidates } from "../../features/submissions/model/duplicates";
import AdminSubmissionStatusBadge from "./AdminSubmissionStatusBadge";
import AdminQualityBadge from "./AdminQualityBadge";
import AdminUserAvatar from "./AdminUserAvatar";
import AdminActionMenu, { type ActionMenuItem } from "./AdminActionMenu";
import { displayNameFor } from "../../features/admin/model/usersQuery";

function relativeAge(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatEventDate(iso: string, time: string | null): string {
  const date = new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!time) return `${date} · Time TBD`;
  const [hh, mm] = time.split(":");
  const hour = Number(hh);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${date} · ${displayHour}:${mm} ${period}`;
}

export default function AdminSubmissionsTable({
  rows, canonicalEvents, submitterFor, onReview, onApprove, onReject, onViewSubmitter,
}: {
  rows: SubmissionRow[];
  canonicalEvents: DatabaseEvent[];
  submitterFor: (row: SubmissionRow) => AdminUserRow;
  onReview: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (row: SubmissionRow) => void;
  onViewSubmitter: (row: SubmissionRow) => void;
}) {
  const now = new Date();

  return (
    <>
      <table className="admin-submissions-table">
        <thead>
          <tr>
            <th>Event</th><th>Event Date</th><th>Submitted By</th><th>Submitted</th>
            <th>Quality</th><th>Duplicate</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const data = effectiveData(row);
            const issues = submissionQualityIssues(data);
            const requiredGap = hasRequiredGap(issues);
            const candidates = findDuplicateCandidates(data, canonicalEvents, []);
            const highDuplicate = candidates.some((c) => c.confidence === "high");
            const submitter = submitterFor(row);

            const items: ActionMenuItem[] = [
              { id: "review", label: "Review", onSelect: () => onReview(row.id) },
              ...(requiredGap ? [] : [{ id: "approve", label: "Approve", onSelect: () => onApprove(row.id) }]),
              { id: "reject", label: "Reject", tone: "danger" as const, separatorBefore: true, onSelect: () => onReject(row) },
              { id: "submitter", label: "View Submitter", onSelect: () => onViewSubmitter(row) },
            ];

            return (
              <tr key={row.id}>
                <td>
                  <Link to={`/admin/submissions/${row.id}`}>{data.title}</Link>
                  <p>{data.dance_styles && data.dance_styles.length > 0 ? data.dance_styles.join(", ") : "No styles listed"}</p>
                </td>
                <td>{formatEventDate(data.event_date, data.event_time)}</td>
                <td>
                  <AdminUserAvatar row={submitter} size={32} />
                  {displayNameFor(submitter)}
                  {submitter.kind === "guest" && <span className="admin-chip">Magic-link only</span>}
                </td>
                <td title={new Date(row.submitted_at).toLocaleDateString()}>{relativeAge(row.submitted_at, now)}</td>
                <td>
                  <AdminQualityBadge
                    issues={issues}
                    labelFor={(issue) => SUBMISSION_QUALITY_LABEL[issue as keyof typeof SUBMISSION_QUALITY_LABEL]}
                    eventTitle={data.title}
                  />
                </td>
                <td>{highDuplicate && <span className="admin-chip admin-chip--warning">Possible Duplicate</span>}</td>
                <td><AdminSubmissionStatusBadge status={row.status} /></td>
                <td><AdminActionMenu label={`Actions for ${data.title}`} items={items} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="admin-submissions-cards">
        {rows.map((row) => {
          const data = effectiveData(row);
          const issues = submissionQualityIssues(data);
          const candidates = findDuplicateCandidates(data, canonicalEvents, []);
          const highDuplicate = candidates.some((c) => c.confidence === "high");
          const submitter = submitterFor(row);
          return (
            <li key={row.id} className="admin-submissions-cards__item">
              <Link to={`/admin/submissions/${row.id}`}>{data.title}</Link>
              <p>{formatEventDate(data.event_date, data.event_time)}</p>
              <p>{displayNameFor(submitter)}</p>
              <AdminQualityBadge
                issues={issues}
                labelFor={(issue) => SUBMISSION_QUALITY_LABEL[issue as keyof typeof SUBMISSION_QUALITY_LABEL]}
                eventTitle={data.title}
              />
              {highDuplicate && <span className="admin-chip admin-chip--warning">Possible Duplicate</span>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
```

- [ ] **Step 4: Add CSS** for `.admin-submissions-table`/`.admin-submissions-cards` matching `AdminEventsTable`'s/`AdminUsersTable`'s exact dual-render breakpoint (`display: none` swap at the project's established mobile breakpoint — grep `admin.css` for the existing `.admin-events-table`/`.admin-events-cards` breakpoint rule and mirror it exactly, do not invent a new breakpoint value).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/Admin/AdminSubmissionsTable.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Admin/AdminSubmissionsTable.tsx src/components/Admin/AdminSubmissionsTable.test.tsx src/styles/admin.css
git commit -m "feat: add AdminSubmissionsTable with dual table/card rendering"
```

---

## Task 28: `AdminSubmissionsPage` — `/admin/submissions` queue

**Files:**
- Create: `src/pages/AdminSubmissionsPage.tsx`
- Test: `src/pages/AdminSubmissionsPage.test.tsx`

**Interfaces:**
- Consumes: `useAdminSubmissions` (Task 25), `useAdminUsers` (existing), `useAdminEvents` (existing, for `canonicalEvents`), `SUBMISSION_VIEWS`/`applySubmissionView`/`applySubmissionFilters`/`viewCounts` (Task 9), `AdminSubmissionsTable` (Task 27), `AdminSubmissionsFilterDrawer` (Task 26), `AdminPageHeader`/`AdminViewTabs`/`AdminPagination` (existing, reused verbatim), `AdminRejectSubmissionDialog` (Task 24), `AdminToast` (existing).

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminSubmissionsPage from "./AdminSubmissionsPage";

const mockSubmissions = vi.fn();
const mockApprove = vi.fn();
vi.mock("../hooks/useAdminSubmissions", () => ({ useAdminSubmissions: () => mockSubmissions() }));
vi.mock("../hooks/useAdminUsers", () => ({ useAdminUsers: () => ({ users: [], isLoading: false, error: null }) }));
vi.mock("../hooks/useAdminEvents", () => ({ useAdminEvents: () => ({ events: [], isLoading: false, error: null }) }));

function renderPage() {
  return render(<MemoryRouter><AdminSubmissionsPage /></MemoryRouter>);
}

describe("AdminSubmissionsPage", () => {
  it("shows 'You're all caught up.' when the pending view is empty", () => {
    mockSubmissions.mockReturnValue({
      submissions: [], isLoading: false, error: null, refetch: vi.fn(),
      approve: mockApprove, approvingId: null, approveError: null,
      reject: vi.fn(), rejectingId: null, rejectError: null,
      saveEdits: vi.fn(), reopen: vi.fn(), dismissDuplicate: vi.fn(),
    });
    renderPage();
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it("shows 'No submissions yet.' when there is nothing in the database at all, regardless of view", () => {
    mockSubmissions.mockReturnValue({
      submissions: [], isLoading: false, error: null, refetch: vi.fn(),
      approve: mockApprove, approvingId: null, approveError: null,
      reject: vi.fn(), rejectingId: null, rejectError: null,
      saveEdits: vi.fn(), reopen: vi.fn(), dismissDuplicate: vi.fn(),
    });
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /All/ }));
    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
  });

  it("renders the five views in the specified tab order", () => {
    mockSubmissions.mockReturnValue({
      submissions: [], isLoading: false, error: null, refetch: vi.fn(),
      approve: mockApprove, approvingId: null, approveError: null,
      reject: vi.fn(), rejectingId: null, rejectError: null,
      saveEdits: vi.fn(), reopen: vi.fn(), dismissDuplicate: vi.fn(),
    });
    renderPage();
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs.join(" ")).toMatch(/Pending.*Needs Attention.*Duplicates.*Upcoming Soon.*All/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/AdminSubmissionsPage.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**, following `AdminEventsPage.tsx`'s exact composition order (`AdminPageHeader` → error banner → `AdminViewTabs` → toolbar-card with debounced search + filter chips → `role="status"` result count → tabpanel card with `AdminSubmissionsTable` + `AdminPagination` → `AdminSubmissionsFilterDrawer` → `AdminRejectSubmissionDialog`):

```tsx
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminViewTabs from "../components/Admin/AdminViewTabs";
import AdminPagination from "../components/Admin/AdminPagination";
import AdminSubmissionsTable from "../components/Admin/AdminSubmissionsTable";
import AdminSubmissionsFilterDrawer from "../components/Admin/AdminSubmissionsFilterDrawer";
import AdminRejectSubmissionDialog from "../components/Admin/AdminRejectSubmissionDialog";
import AdminToast from "../components/Admin/AdminToast";
import { useAdminSubmissions } from "../hooks/useAdminSubmissions";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useAdminEvents } from "../hooks/useAdminEvents";
import { useAuth } from "../contexts/useAuth";
import {
  SUBMISSION_VIEWS, applySubmissionView, applySubmissionFilters, viewCounts,
  type SubmissionView, type SubmissionFilters,
} from "../features/submissions/model/submissionsQuery";
import type { SubmissionRow } from "../features/submissions/model/types";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "../features/admin/model/eventsQuery";

const EMPTY_FILTERS: SubmissionFilters = { q: "", city: null, style: null, submitterKind: null, status: null };

function submitterRowFor(row: SubmissionRow, users: ReturnType<typeof useAdminUsers>["users"]) {
  const key = row.submitter_id ?? `guest:${(row.submitter_email ?? "").toLowerCase()}`;
  return (
    users?.find((u) => (row.submitter_id ? u.user_id === row.submitter_id : u.id === key)) ?? {
      kind: row.submitter_id ? "profile" : "guest",
      id: key, user_id: row.submitter_id, email: row.submitter_email ?? "",
      display_name: row.submitter_name, username: null, avatar_url: null, role: null,
      status: "active", status_reason: null, created_at: row.submitted_at,
      last_active_at: row.submitted_at, contributions: 0, pending_count: 0,
      approved_count: 0, email_confirmed_at: null,
    }
  );
}

export default function AdminSubmissionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { submissions, isLoading, error, approve, reject, rejectingId, rejectError } = useAdminSubmissions();
  const { users } = useAdminUsers();
  const { events: canonicalEvents } = useAdminEvents();
  const { user: authUser } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<SubmissionRow | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [filters, setFilters] = useState<SubmissionFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const view = (searchParams.get("view") as SubmissionView) || "pending";
  const now = new Date();

  const allRows = submissions ?? [];
  const isEmptyDb = allRows.length === 0;

  const viewed = useMemo(
    () => applySubmissionView(allRows, view, now, canonicalEvents ?? [], []),
    [allRows, view, canonicalEvents]
  );
  const filtered = useMemo(() => applySubmissionFilters(viewed, filters), [viewed, filters]);
  const counts = useMemo(
    () => viewCounts(allRows, now, canonicalEvents ?? [], []),
    [allRows, canonicalEvents]
  );

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function handleApprove(id: string) {
    try {
      await approve({ id, reviewerId: authUser!.id });
      setToast({ message: "Approved — published to the calendar.", tone: "success" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Approve failed", tone: "error" });
    }
  }

  async function handleReject(input: { reason: import("../features/submissions/model/types").RejectionReason; message: string | null; internalNote: string | null }) {
    if (!rejectTarget) return;
    await reject({ id: rejectTarget.id, reviewerId: authUser!.id, input });
    setRejectTarget(null);
  }

  return (
    <div className="admin-submissions-page">
      <AdminPageHeader title="Submissions" description="Review event suggestions before they reach the calendar." />

      {error && (
        <div className="admin-banner admin-banner--error" role="alert">
          {error}
        </div>
      )}

      <AdminViewTabs
        views={SUBMISSION_VIEWS}
        active={view}
        counts={counts}
        panelId="admin-submissions-tabpanel"
        ariaLabel="Submission views"
        selectId="admin-submissions-view-select"
        selectLabel="Submission view"
        onChange={(next) => setSearchParams((prev) => { prev.set("view", next); return prev; })}
      />

      <div className="admin-card admin-submissions-page__toolbar-card">
        <input
          type="search"
          placeholder="Search submissions…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setDrawerOpen(true)}>
          ⚙ More Filters
        </button>
      </div>

      <p role="status" className="admin-submissions-page__result-count">
        {filtered.length} submission{filtered.length === 1 ? "" : "s"}
      </p>

      <div className="admin-card admin-submissions-page__table-card" id="admin-submissions-tabpanel" role="tabpanel">
        {isLoading ? (
          <p role="status">Loading…</p>
        ) : isEmptyDb ? (
          <p>No submissions yet.</p>
        ) : filtered.length === 0 && view === "pending" ? (
          <p>You're all caught up.</p>
        ) : filtered.length === 0 ? (
          <p>No submissions match these filters.</p>
        ) : (
          <>
            <AdminSubmissionsTable
              rows={pageRows}
              canonicalEvents={canonicalEvents ?? []}
              submitterFor={(row) => submitterRowFor(row, users)}
              onReview={(id) => navigate(`/admin/submissions/${id}`)}
              onApprove={handleApprove}
              onReject={setRejectTarget}
              onViewSubmitter={(row) => navigate(`/admin/users/${submitterRowFor(row, users).id}`)}
            />
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      <AdminSubmissionsFilterDrawer
        open={drawerOpen}
        filters={filters}
        onFiltersChange={setFilters}
        onClose={() => setDrawerOpen(false)}
      />

      {rejectTarget && (
        <AdminRejectSubmissionDialog
          title={`Reject "${rejectTarget.submitted_data.title}"?`}
          isBusy={rejectingId === rejectTarget.id}
          error={rejectingId === rejectTarget.id ? rejectError : null}
          onConfirm={handleReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {toast && <AdminToast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}
```

- [ ] **Step 4: Add CSS** for `.admin-submissions-page__*` classes, matching `AdminEventsPage`'s equivalent block structure verbatim (toolbar-card padding, result-count typography, table-card layout).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/pages/AdminSubmissionsPage.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminSubmissionsPage.tsx src/pages/AdminSubmissionsPage.test.tsx src/styles/admin.css
git commit -m "feat: add AdminSubmissionsPage queue"
```

---

## Task 29: `AdminSubmissionDetailPage` — `/admin/submissions/:id` review workspace

**Files:**
- Create: `src/pages/AdminSubmissionDetailPage.tsx`
- Test: `src/pages/AdminSubmissionDetailPage.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 5–11, 17–25 (`effectiveData`, `editedFields`, `submissionQualityIssues`, `findDuplicateCandidates`, `matchVenue`, `buildAdminFormFromSubmission`, `useAdminSubmissions`, `useAdminUsers`, `useAdminEvents`, `useSubmissionAuditLog`, `auditLogLabelFor`/`actorLabelFor`, `AdminSubmitterPanel`, `AdminSubmissionQualityPanel`, `AdminDuplicateCheckPanel`, `AdminVenueMatchPanel`, `AdminEditedFieldDisclosure`, `AdminRejectSubmissionDialog`, `AdminSubmissionStatusBadge`, `AdminEventForm`, `AdminToast`).

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminSubmissionDetailPage from "./AdminSubmissionDetailPage";
import type { SubmissionRow, SubmittedEventData } from "../features/submissions/model/types";

const data: SubmittedEventData = {
  title: "Bachata on the Harbor", description: "A social.", event_type: "social",
  event_date: "2026-08-24", event_time: "18:00:00", location: "Havana Club", address: null,
  price_type: "free", price_amount: null, rsvp_link: null, image_url: null,
  submitter_name: null, submitter_email: "guest@example.com", submitter_id: null,
  dance_styles: ["bachata"], city: "boston", host: "Maria", recurrence: null,
  gallery: null, contact_email: null, contact_instagram: null, contact_website: null,
};

function submission(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
  return {
    id: "sub-1", submitter_id: null, submitter_email: "guest@example.com", submitter_name: null,
    status: "pending", submitted_data: data, edited_data: null,
    submitted_at: "2026-08-12T00:00:00Z", reviewed_by: null, reviewed_at: null,
    rejection_reason: null, rejection_message: null, internal_note: null,
    duplicate_of_event_id: null, dismissed_duplicate_ids: [], approved_event_id: null,
    created_at: "2026-08-12T00:00:00Z", updated_at: "2026-08-12T00:00:00Z", ...overrides,
  };
}

const mockApprove = vi.fn();
const mockUseAdminSubmissions = vi.fn();
vi.mock("../hooks/useAdminSubmissions", () => ({ useAdminSubmissions: () => mockUseAdminSubmissions() }));
vi.mock("../hooks/useAdminUsers", () => ({ useAdminUsers: () => ({ users: [], isLoading: false, error: null }) }));
vi.mock("../hooks/useAdminEvents", () => ({ useAdminEvents: () => ({ events: [], isLoading: false, error: null }) }));
vi.mock("../hooks/useSubmissionAuditLog", () => ({
  useSubmissionAuditLog: () => ({ entries: [], isLoading: false, error: null, refetch: vi.fn() }),
}));

function renderPage(id = "sub-1") {
  return render(
    <MemoryRouter initialEntries={[`/admin/submissions/${id}`]}>
      <Routes><Route path="/admin/submissions/:id" element={<AdminSubmissionDetailPage />} /></Routes>
    </MemoryRouter>
  );
}

describe("AdminSubmissionDetailPage", () => {
  it("disables Approve & Publish and shows a reason when a Required-tier gap exists", () => {
    mockUseAdminSubmissions.mockReturnValue({
      submissions: [submission({ submitted_data: { ...data, title: "" } })],
      isLoading: false, error: null, refetch: vi.fn(),
      approve: mockApprove, approvingId: null, approveError: null,
      reject: vi.fn(), rejectingId: null, rejectError: null,
      saveEdits: vi.fn(), reopen: vi.fn(), dismissDuplicate: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole("button", { name: /Approve & Publish/ })).toBeDisabled();
  });

  it("enables Approve & Publish with no confirmation dialog when complete", async () => {
    mockUseAdminSubmissions.mockReturnValue({
      submissions: [submission()],
      isLoading: false, error: null, refetch: vi.fn(),
      approve: mockApprove, approvingId: null, approveError: null,
      reject: vi.fn(), rejectingId: null, rejectError: null,
      saveEdits: vi.fn(), reopen: vi.fn(), dismissDuplicate: vi.fn(),
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Approve & Publish/ }));
    await waitFor(() => expect(mockApprove).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the sticky Review Panel action stack in order: Reject, Edit & Approve, Approve & Publish", () => {
    mockUseAdminSubmissions.mockReturnValue({
      submissions: [submission()],
      isLoading: false, error: null, refetch: vi.fn(),
      approve: mockApprove, approvingId: null, approveError: null,
      reject: vi.fn(), rejectingId: null, rejectError: null,
      saveEdits: vi.fn(), reopen: vi.fn(), dismissDuplicate: vi.fn(),
    });
    renderPage();
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    const rejectIdx = buttons.findIndex((t) => t?.includes("Reject"));
    const editIdx = buttons.findIndex((t) => t?.includes("Edit & Approve"));
    const approveIdx = buttons.findIndex((t) => t?.includes("Approve & Publish"));
    expect(rejectIdx).toBeLessThan(editIdx);
    expect(editIdx).toBeLessThan(approveIdx);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/AdminSubmissionDetailPage.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**, structurally mirroring `AdminUserDetailPage.tsx` (back link → header → two-column grid body → `PendingAction`-driven dialogs at the bottom):

```tsx
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAdminSubmissions } from "../hooks/useAdminSubmissions";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useAdminEvents } from "../hooks/useAdminEvents";
import { useSubmissionAuditLog } from "../hooks/useSubmissionAuditLog";
import { useAuth } from "../contexts/useAuth";
import { effectiveData, editedFields, buildAdminFormFromSubmission } from "../features/submissions/model/submissionForm";
import { submissionQualityIssues, hasRequiredGap } from "../features/submissions/model/quality";
import { findDuplicateCandidates } from "../features/submissions/model/duplicates";
import { matchVenue } from "../features/submissions/model/venueMatching";
import { auditLogLabelFor, actorLabelFor } from "../features/admin/model/auditLog";
import AdminSubmissionStatusBadge from "../components/Admin/AdminSubmissionStatusBadge";
import AdminSubmitterPanel from "../components/Admin/AdminSubmitterPanel";
import AdminSubmissionQualityPanel from "../components/Admin/AdminSubmissionQualityPanel";
import AdminDuplicateCheckPanel from "../components/Admin/AdminDuplicateCheckPanel";
import AdminVenueMatchPanel from "../components/Admin/AdminVenueMatchPanel";
import AdminEditedFieldDisclosure from "../components/Admin/AdminEditedFieldDisclosure";
import AdminRejectSubmissionDialog from "../components/Admin/AdminRejectSubmissionDialog";
import AdminEventForm from "../components/Admin/AdminEventForm";
import AdminToast from "../components/Admin/AdminToast";
import type { RejectionReason, SubmittedEventData } from "../features/submissions/model/types";

type PendingAction = { kind: "reject" } | { kind: "edit" } | null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function AdminSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const {
    submissions, approve, approvingId, approveError,
    reject, rejectingId, rejectError, saveEdits, dismissDuplicate,
  } = useAdminSubmissions();
  const { users } = useAdminUsers();
  const { events: canonicalEvents } = useAdminEvents();
  const submission = submissions?.find((s) => s.id === id);
  const { entries: auditEntries, isLoading: isAuditLoading } = useSubmissionAuditLog(id!);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  if (!submission) return null;

  const data = effectiveData(submission);
  const edited = editedFields(submission);
  const issues = submissionQualityIssues(data);
  const requiredGap = hasRequiredGap(issues);
  const duplicateCandidates = findDuplicateCandidates(data, canonicalEvents ?? [], [])
    .filter((c) => !submission.dismissed_duplicate_ids.includes(c.event.id));
  const venueMatch = matchVenue(data.location, canonicalEvents ?? []);
  const submitter = users?.find((u) =>
    submission.submitter_id ? u.user_id === submission.submitter_id : u.id === `guest:${(submission.submitter_email ?? "").toLowerCase()}`
  ) ?? {
    kind: submission.submitter_id ? ("profile" as const) : ("guest" as const),
    id: submission.submitter_id ?? `guest:${(submission.submitter_email ?? "").toLowerCase()}`,
    user_id: submission.submitter_id, email: submission.submitter_email ?? "",
    display_name: submission.submitter_name, username: null, avatar_url: null, role: null,
    status: "active" as const, status_reason: null, created_at: submission.submitted_at,
    last_active_at: submission.submitted_at, contributions: 0, pending_count: 0,
    approved_count: 0, email_confirmed_at: null,
  };

  const closeDialog = () => setPendingAction(null);

  async function handleApprove() {
    try {
      const { eventId } = await approve({ id: submission.id, reviewerId: authUser!.id });
      setToast({ message: "Approved — published to the calendar.", tone: "success" });
      void eventId;
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Approve failed", tone: "error" });
    }
  }

  async function handleReject(input: { reason: RejectionReason; message: string | null; internalNote: string | null }) {
    await reject({ id: submission.id, reviewerId: authUser!.id, input });
    closeDialog();
    navigate("/admin/submissions");
  }

  async function handleSaveCorrections(form: SubmittedEventData) {
    await saveEdits({ id: submission.id, edited: form });
    closeDialog();
  }

  async function handleSaveAndApprove(form: SubmittedEventData) {
    await saveEdits({ id: submission.id, edited: form });
    closeDialog();
    await handleApprove();
  }

  return (
    <div className="admin-submission-detail-page">
      <Link to="/admin/submissions" className="admin-submission-detail-page__back">← Submissions</Link>

      <header className="admin-submission-detail-page__header">
        <h1>{data.title}</h1>
        <AdminSubmissionStatusBadge status={submission.status} />
        <p>Submitted {formatDate(submission.submitted_at)}</p>
      </header>

      {pendingAction?.kind === "edit" ? (
        <AdminEventForm
          initial={buildAdminFormFromSubmission(data)}
          heading="Edit submission"
          submitLabel="Save corrections"
          isSaving={false}
          error={null}
          onSubmit={(form) => handleSaveCorrections(form as unknown as SubmittedEventData)}
          onCancel={closeDialog}
        />
      ) : (
        <div className="admin-submission-detail-page__body">
          <section className="admin-card admin-submission-detail-page__info">
            {edited.length > 0 && <p>{edited.length} fields edited by @moderator</p>}

            <h3>Basic Info</h3>
            <AdminEditedFieldDisclosure label="Title" current={data.title} original={submission.submitted_data.title} />
            <AdminEditedFieldDisclosure
              label="Venue"
              current={data.location ?? ""}
              original={submission.submitted_data.location ?? ""}
            />
            <AdminVenueMatchPanel
              match={venueMatch}
              submittedLocation={data.location ?? ""}
              submittedAddress={data.address}
              onUseExisting={() => {
                if (venueMatch.kind === "fuzzy") {
                  void saveEdits({ id: submission.id, edited: { location: venueMatch.location, address: venueMatch.address ?? data.address } });
                }
              }}
            />
          </section>

          <section className="admin-card admin-submission-detail-page__panel">
            <AdminSubmitterPanel submitter={submitter} contributions={submitter.contributions} approvedCount={submitter.approved_count} />
            <AdminSubmissionQualityPanel issues={issues} />
            <AdminDuplicateCheckPanel
              candidates={duplicateCandidates}
              onDismiss={(eventId) => void dismissDuplicate({ id: submission.id, eventId, currentDismissed: submission.dismissed_duplicate_ids })}
              onReject={() => setPendingAction({ kind: "reject" })}
            />

            {requiredGap && <p role="alert">Required information is missing — use Edit & Approve.</p>}

            <div className="admin-submission-detail-page__actions">
              <button type="button" className="admin-btn admin-btn--danger" onClick={() => setPendingAction({ kind: "reject" })}>
                Reject
              </button>
              <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setPendingAction({ kind: "edit" })}>
                Edit & Approve
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={requiredGap || approvingId === submission.id}
                onClick={handleApprove}
              >
                {approvingId === submission.id ? "Working…" : "Approve & Publish"}
              </button>
            </div>
            {approveError && approvingId === null && <p role="alert">{approveError}</p>}
          </section>
        </div>
      )}

      <section className="admin-submission-detail-page__history">
        <h3>Review History</h3>
        {isAuditLoading ? (
          <p role="status">Loading activity…</p>
        ) : (
          <ol>
            {(auditEntries ?? []).map((entry) => (
              <li key={entry.id}>
                {formatDate(entry.created_at)} · {auditLogLabelFor(entry)} by {actorLabelFor(entry.actor_id, users ?? [])}
              </li>
            ))}
          </ol>
        )}
      </section>

      {pendingAction?.kind === "reject" && (
        <AdminRejectSubmissionDialog
          title={`Reject "${data.title}"?`}
          isBusy={rejectingId === submission.id}
          error={rejectingId === submission.id ? rejectError : null}
          onConfirm={handleReject}
          onCancel={closeDialog}
        />
      )}

      {toast && <AdminToast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}
```

Note: `handleSaveAndApprove` is wired as the second `AdminEventForm` submit path per the design doc ("Save & Approve"); since `AdminEventForm` exposes only one `onSubmit`, add a second button inside the form's cancel/submit row via a follow-up small prop (`onSubmitAndApprove?: (form) => void`) OR — simpler and matching "reuse verbatim" — keep `AdminEventForm`'s single `onSubmit` as "Save corrections", and let "Save & Approve" be a distinct action outside the form component: after `AdminEventForm`'s onSubmit fires `handleSaveCorrections`, the review panel's already-visible "Approve & Publish" button (still rendered, since `pendingAction.kind === "edit"` only swaps the left/right columns in this implementation, not the whole page — adjust the conditional render above so the Review Panel's action stack remains visible beside the embedded form, matching the design doc's explicit requirement that Edit & Approve embeds "not a separate route... reviewer never loses context") completes the approval in a second click. Confirm this against the design doc's exact wording before finalizing: the embedded form must render **alongside** the Review Panel, not replace it — fix the conditional in Step 3 to wrap only the Event Information column, keeping the Review Panel column always rendered.

- [ ] **Step 4: Fix the embedded-form layout per the note above**

Rewrite the body so `pendingAction?.kind === "edit"` swaps only the left (`admin-submission-detail-page__info`) column content for `<AdminEventForm>`, while the right (`admin-submission-detail-page__panel`) column's Submitted By / Verification / Quality / Duplicate Check / Notes / action stack remains rendered unconditionally — re-run Step 1's third test (action stack always present) to confirm.

- [ ] **Step 5: Add CSS** for the two-column grid (`grid-template-columns: minmax(0, 1fr) 380px` at ≥1024px, single column below), the sticky panel (`position: sticky; top: calc(var(--admin-header-h) + 16px); max-height: calc(100vh - var(--admin-header-h) - 32px); overflow-y: auto`), and the mobile sticky bottom action bar (`position: fixed; bottom: 0`, `env(safe-area-inset-bottom)` padding, only Reject/Approve in the bar per the design doc — Edit & Approve stays inline).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/pages/AdminSubmissionDetailPage.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/pages/AdminSubmissionDetailPage.tsx src/pages/AdminSubmissionDetailPage.test.tsx src/styles/admin.css
git commit -m "feat: add AdminSubmissionDetailPage review workspace"
```

---

## Task 30: Widen `/admin` auth to admin-or-moderator

**Files:**
- Modify: `src/contexts/authContextObject.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Create: `src/components/Auth/RequireReviewer.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/Auth/RequireReviewer.test.tsx`, extend `src/contexts/AuthContext.test.tsx` if present

**Interfaces:**
- Produces: `AuthContextValue.isModerator: boolean`, `<RequireReviewer>` (admin-or-moderator gate, mirrors `RequireAdmin.tsx` exactly except the boolean it checks) — consumed by `App.tsx`'s `/admin` parent route.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/Auth/RequireReviewer.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import RequireReviewer from "./RequireReviewer";

const mockUseAuth = vi.fn();
vi.mock("../../contexts/useAuth", () => ({ useAuth: () => mockUseAuth() }));

describe("RequireReviewer", () => {
  it("renders children for a moderator", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, loading: false, isAdmin: false, isModerator: true });
    render(<MemoryRouter><RequireReviewer><p>content</p></RequireReviewer></MemoryRouter>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("renders children for an admin", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, loading: false, isAdmin: true, isModerator: false });
    render(<MemoryRouter><RequireReviewer><p>content</p></RequireReviewer></MemoryRouter>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("redirects a plain user away", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, loading: false, isAdmin: false, isModerator: false });
    render(<MemoryRouter><RequireReviewer><p>content</p></RequireReviewer></MemoryRouter>);
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Auth/RequireReviewer.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Add `isModerator` to the auth context**

In `src/contexts/authContextObject.ts`, add `isModerator: boolean;` to `AuthContextValue`, immediately after `isAdmin: boolean;`.

In `src/contexts/AuthContext.tsx`'s `value` object, add:

```ts
  isModerator: user?.app_metadata?.role === "moderator",
```

- [ ] **Step 4: Write `RequireReviewer.tsx`**, mirroring `RequireAdmin.tsx` exactly except the final boolean check:

```tsx
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";

/**
 * Protects the /admin shell for Admins AND Moderators — wider than
 * RequireAdmin, which individual admin-only child routes (users, users/:id)
 * still wrap themselves with.
 */
export default function RequireReviewer({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin, isModerator } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "40vh", fontSize: "1.1rem", color: "var(--muted, #666)" }}>
        Checking session…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }

  if (!isAdmin && !isModerator) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 5: Rewire `App.tsx`**

Change the `/admin` parent route's guard from `<RequireAdmin><AdminLayout /></RequireAdmin>` to `<RequireReviewer><AdminLayout /></RequireReviewer>`, then wrap the admin-only child routes individually:

```tsx
<Route path="/admin" element={<RequireReviewer><AdminLayout /></RequireReviewer>}>
  <Route index element={<AdminOverviewPage />} />
  <Route path="events" element={<AdminEventsPage />} />
  <Route path="submissions" element={<AdminSubmissionsPage />} />
  <Route path="submissions/:id" element={<AdminSubmissionDetailPage />} />
  <Route path="users" element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
  <Route path="users/:id" element={<RequireAdmin><AdminUserDetailPage /></RequireAdmin>} />
</Route>
```

Add the two new lazy imports next to the existing ones:

```tsx
const AdminSubmissionsPage = lazy(() => import("./pages/AdminSubmissionsPage"));
const AdminSubmissionDetailPage = lazy(() => import("./pages/AdminSubmissionDetailPage"));
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/Auth/RequireReviewer.test.tsx`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/contexts/authContextObject.ts src/contexts/AuthContext.tsx src/components/Auth/RequireReviewer.tsx src/components/Auth/RequireReviewer.test.tsx src/App.tsx
git commit -m "feat: widen /admin shell to admin-or-moderator via RequireReviewer"
```

---

## Task 31: Sidebar + breadcrumb wiring

**Files:**
- Modify: `src/components/Admin/AdminSidebar.tsx`
- Modify: `src/layouts/AdminLayout.tsx`
- Modify: `src/layouts/AdminLayout.test.tsx`

**Interfaces:**
- No new exports — pure wiring of existing structures to the new route.

- [ ] **Step 1: Update the failing test**

In `src/layouts/AdminLayout.test.tsx`'s `"shows unbuilt sections as disabled with a Soon badge, not links"` test, remove `"Event Submissions"` from the iterated label array (now only `["Organizer Requests", "Venues", "Tags", "Settings"]`). Add a new test:

```tsx
it("renders Event Submissions as a live link", () => {
  renderLayout();
  expect(screen.getByRole("link", { name: "Event Submissions" })).toHaveAttribute("href", "/admin/submissions");
});

it("breadcrumb reads Submissions on the submissions list and detail routes", () => {
  renderLayoutAt("/admin/submissions");
  expect(screen.getByText("Submissions", { selector: ".admin-breadcrumbs__current" })).toBeInTheDocument();
});
```

(Extend `renderLayoutAt`'s nested `<Routes>` fixture to also register `<Route path="submissions" element={<p>List content</p>} />` if the test needs to navigate there — mirror the existing `users/:id` registration pattern in that same helper.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/layouts/AdminLayout.test.tsx`
Expected: FAIL — `Event Submissions` is still `built: false`; no breadcrumb entry exists.

- [ ] **Step 3: Flip the sidebar nav item**

In `src/components/Admin/AdminSidebar.tsx`, change line 36 from:

```ts
  { group: "Review", label: "Event Submissions", icon: ClipboardCheck, built: false },
```

to:

```ts
  { group: "Review", label: "Event Submissions", icon: ClipboardCheck, to: "/admin/submissions", built: true },
```

- [ ] **Step 4: Add the breadcrumb entries**

In `src/layouts/AdminLayout.tsx`, update `SECTION_LABEL` and `sectionLabelFor`:

```ts
const SECTION_LABEL: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/events": "Events",
  "/admin/users": "Users",
  "/admin/submissions": "Submissions",
};

function sectionLabelFor(pathname: string): string {
  if (SECTION_LABEL[pathname]) return SECTION_LABEL[pathname];
  if (pathname.startsWith("/admin/users/")) return "Users";
  if (pathname.startsWith("/admin/submissions/")) return "Submissions";
  return SECTION_LABEL["/admin"];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/layouts/AdminLayout.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Admin/AdminSidebar.tsx src/layouts/AdminLayout.tsx src/layouts/AdminLayout.test.tsx
git commit -m "feat: enable Event Submissions nav link and breadcrumb"
```

---

## Task 32: Overview page pending-count wiring finalization

**Files:**
- Modify: `src/pages/AdminOverviewPage.tsx`

**Interfaces:**
- Replaces the Task 16 stub with `useAdminSubmissions()` (Task 25), now that it exists.

- [ ] **Step 1: Update `AdminOverviewPage.tsx`**

Replace whatever inline `useQuery`/stub Task 16 introduced with:

```ts
import { useAdminSubmissions } from "../hooks/useAdminSubmissions";
// ...
const { submissions } = useAdminSubmissions();
const pendingSubmissionCount = (submissions ?? []).filter((s) => s.status === "pending").length;
// ...
const metrics = deriveOverviewMetrics(events ?? [], new Date(), users ?? [], pendingSubmissionCount);
```

- [ ] **Step 2: Run the existing overview page test suite**

Run: `npx vitest run src/pages/AdminOverviewPage.test.tsx`
Expected: PASS (update the test's mocks to include `useAdminSubmissions` returning a fixed `submissions` array if the existing suite doesn't already).

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminOverviewPage.tsx src/pages/AdminOverviewPage.test.tsx
git commit -m "refactor: wire AdminOverviewPage to useAdminSubmissions for pending count"
```

---

## Task 33: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: zero errors. Fix any residual type drift from the `eventsRepo.ts` deletions (Tasks 12, 15) or the `AdminEventForm`/`SubmittedEventData` type bridging in Task 29 before proceeding.

- [ ] **Step 2: Full lint**

Run: `npm run lint -- --max-warnings 0`
Expected: zero warnings/errors.

- [ ] **Step 3: Full test suite**

Run: `npx vitest run`
Expected: 100% pass, including every pre-existing suite touched by this plan (`ProfilePage`, `UserEventEditPage`, `useSubmitEventForm`, `useMySubmissions`, `overviewMetrics`, `AdminQualityBadge`, `AdminLayout`, plus all new Phase 7 suites). Report the exact passing count (e.g. `274/274`) per project convention — do not summarize as "all passing" without the number.

- [ ] **Step 4: Local Supabase smoke test**

Run: `npx supabase db reset`
Expected: applies cleanly end to end (migrations 1–17, in order, including `20260817000000_event_submissions.sql`). Then manually, via Supabase Studio or `psql`:
- Insert one submission via `supabase.from("event_submissions").insert(...)` (or through the running dev app's `/submit` form) and confirm it appears in `select * from event_submissions where status='pending'`.
- Call `admin_user_directory()` and confirm `approved_count` is present and correct for a seeded profile with at least one `approved` event.

- [ ] **Step 5: Manual smoke test of the built UI**

Run: `npm run dev`, then in a browser:
- Sign in as an admin. Confirm the sidebar's "Event Submissions" item is a live link (no "Soon" badge) and navigates to `/admin/submissions`.
- Confirm the queue defaults to the Pending tab, the five tabs render in order (Pending, Needs Attention, Duplicates, Upcoming Soon, All), and the empty states match the design doc's copy exactly ("You're all caught up." on Pending when empty; "No submissions yet." only when the table is truly empty).
- Open a submission's Review page. Confirm the two-column layout at desktop width, the Review Panel's sticky behavior on scroll, and single-column collapse below 1024px (resize the viewport).
- Approve a complete submission; confirm the success toast, that it disappears from the Pending view, and that a corresponding row now exists in `/admin/events`.
- Reject a submission with reason "Other" and an empty internal note; confirm the inline validation error blocks submission until a note is entered.
- Sign in (or seed) a `moderator`-role account; confirm it can reach `/admin/submissions` but is redirected away from `/admin/users`.

- [ ] **Step 6: Update the design doc's implementation-status note (optional, only if the project's convention tracks phase completion in `Docs/plans/`)**

No file changes required by default — confirm with the user whether `Docs/plans/phase7-event-submission-review.md` should be annotated as "Implemented" or left as the historical design record (existing Phase 3/5/6 docs were left unannotated per repo convention — default to leaving it unchanged unless told otherwise).

- [ ] **Step 7: Report completion**

Summarize to the user: migration applied, all 33 tasks committed, exact test count passing, lint/tsc clean, and the two required manual confirmations (moderator access, approve-creates-event) performed.
