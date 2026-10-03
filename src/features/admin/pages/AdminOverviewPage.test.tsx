import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { DatabaseEvent } from "../../events/model/types";
import type { AdminUserRow } from "../model/usersQuery";
import type { AuthContextValue } from "../../../contexts/authContextObject";
import AdminOverviewPage from "./AdminOverviewPage";

const { useAdminEvents, useAdminUserCount, useAdminUsers, useOrganizerRequests, useAdminVenues } =
  vi.hoisted(() => ({
    useAdminEvents: vi.fn(),
    useAdminUserCount: vi.fn(),
    useAdminUsers: vi.fn(),
    useOrganizerRequests: vi.fn(),
    useAdminVenues: vi.fn(),
  }));

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
const { useAdminSubmissions } = vi.hoisted(() => ({ useAdminSubmissions: vi.fn() }));
const { useMySubmissions } = vi.hoisted(() => ({ useMySubmissions: vi.fn() }));
vi.mock("../../account/hooks/useMySubmissions", () => ({ useMySubmissions }));

vi.mock("../hooks/useAdminEvents", () => ({ useAdminEvents }));
vi.mock("../hooks/useAdminUserCount", () => ({ useAdminUserCount }));
vi.mock("../hooks/useAdminUsers", () => ({ useAdminUsers }));
vi.mock("../hooks/useOrganizerRequests", () => ({ useOrganizerRequests }));
vi.mock("../hooks/useAdminVenues", () => ({ useAdminVenues }));
vi.mock("../hooks/useAdminSubmissionList", () => ({ useAdminSubmissions }));
vi.mock("../../../contexts/useAuth", () => ({ useAuth }));

// The component derives its metrics from the real clock (`new Date()` inside
// its own useMemo, per the purity-lint-safe pattern), so fixture dates are
// relative to test-run time rather than hardcoded.
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function authState(role: AuthContextValue["role"]): AuthContextValue {
  return {
    user: null,
    session: null,
    loading: false,
    role,
    isAdmin: role === "admin",
    isModerator: role === "moderator",
    isOrganizer: role === "organizer",
    signInWithPassword: vi.fn(),
    resendConfirmation: vi.fn(),
    requestPasswordReset: vi.fn(),
    updateEmail: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    clearDeletedAccount: vi.fn(),
  };
}

const baseEvent: DatabaseEvent = {
  id: "event-1",
  title: "Bachata Sensual Social",
  description: null,
  event_type: "social",
  event_date: daysFromNow(10),
  event_time: "20:00",
  location: "Havana Club",
  address: null,
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: "https://example.com/image.jpg",
  submitter_name: "Ada",
  submitter_email: "ada@salsa.test",
  submitter_id: null,
  status: "approved",
  city: "boston",
  created_at: "2026-08-05T00:00:00.000Z",
  host: null,
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  source_type: "user_submission",
  taxonomy_term_ids: [],
  taxonomy_terms: [],
  updated_at: "2026-08-05T00:00:00.000Z",
  cancellation_reason: null,
  venue_id: null,
};

// Known fixture: 2 approved-future within 30 days (1 complete, 1 missing venue
// -> "incomplete"), 1 approved-past (excluded from both), 2 pending, 1 rejected
// — 6 total events. upcomingCount=2, pendingCount=2, incompleteCount=1.
const events: DatabaseEvent[] = [
  baseEvent,
  {
    ...baseEvent,
    id: "event-2",
    title: "Incomplete Future Event",
    event_date: daysFromNow(15),
    location: null,
  },
  {
    ...baseEvent,
    id: "event-3",
    title: "Past Approved Event",
    event_date: daysFromNow(-5),
    city: "new-york-city",
  },
  { ...baseEvent, id: "event-4", title: "Pending One", status: "pending" },
  { ...baseEvent, id: "event-5", title: "Pending Two", status: "pending", city: "new-york-city" },
  { ...baseEvent, id: "event-6", title: "Rejected One", status: "rejected" },
];

const baseUser: AdminUserRow = {
  kind: "profile",
  id: "user-1",
  user_id: "user-1",
  email: "test@test.com",
  display_name: "Test User",
  username: "testuser",
  avatar_url: null,
  role: null,
  status: "active",
  status_reason: null,
  created_at: "2026-08-05T00:00:00.000Z",
  last_active_at: "2026-08-05T00:00:00.000Z",
  contributions: 3,
  pending_count: 0,
  email_confirmed_at: "2026-08-05T00:00:00.000Z",
  approved_count: 0,
};

const users: AdminUserRow[] = [
  baseUser,
  { ...baseUser, id: "user-2", user_id: "user-2", role: "organizer", status: "active" },
  {
    ...baseUser,
    id: "user-3",
    user_id: "user-3",
    role: "user",
    status: "flagged",
    status_reason: "Suspicious activity",
  },
];

const defaultEventsState = {
  events,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  decide: vi.fn(),
  decidingId: null,
  decidingStatus: null,
  decideErrorId: null,
  decideError: null,
  save: vi.fn(),
  isSaving: false,
  saveError: null,
  remove: vi.fn(),
  removingId: null,
  removeErrorId: null,
  removeError: null,
};

const defaultUsersState = {
  users,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  setRole: vi.fn(),
  settingRoleId: null,
  setRoleErrorId: null,
  setRoleError: null,
  setStatus: vi.fn(),
  settingStatusId: null,
  setStatusErrorId: null,
  setStatusError: null,
};

const defaultUserCountState = {
  count: 4,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

const defaultOrganizerRequestsState = {
  requests: [],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  pendingCount: 0,
  pendingCountLoading: false,
  pendingCountError: null,
  approve: vi.fn(),
  isApproving: false,
  approveErrorId: null,
  approveError: null,
  reject: vi.fn(),
  isRejecting: false,
  rejectErrorId: null,
  rejectError: null,
  revoke: vi.fn(),
  isRevoking: false,
  revokeError: null,
};

const defaultSubmissionsState = {
  submissions: [] as unknown[],
  isLoading: false,
  error: null,
  updateSubmission: vi.fn(),
  updateSubmissionAsync: vi.fn(),
  isUpdating: false,
  updateError: null,
  approveSubmissionWithTaxonomy: vi.fn(),
  isApproving: false,
  approveError: null,
};

function submission(id: string, title: string, dayOffset: number) {
  return {
    id,
    submitter_id: null,
    submitter_email: "ada@salsa.test",
    submitter_name: "Ada",
    status: "pending",
    submitted_data: {
      title,
      event_date: daysFromNow(dayOffset),
      location: "Havana Club",
      image_url: "https://example.com/flyer.jpg",
      taxonomy_term_ids: [],
    },
    edited_data: null,
    submitted_at: daysFromNow(-1),
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    rejection_message: null,
    internal_note: null,
    duplicate_of_event_id: null,
    dismissed_duplicate_ids: [],
    approved_event_id: null,
    created_at: daysFromNow(-1),
    updated_at: daysFromNow(-1),
  };
}

function renderPage() {
  return render(<AdminOverviewPage />, { wrapper: MemoryRouter });
}

/** The standing rule states each count as "<figure> <label>". */
function countFigure(label: RegExp): string {
  const node = screen.getByText(label).closest(".desk__count") as HTMLElement;
  return within(node).getByText(/^\d+$/).textContent ?? "";
}

function galley(): HTMLElement {
  return screen.getByRole("region", { name: "Galley" });
}

function column(): HTMLElement {
  return screen.getByRole("region", { name: "Set for the week" });
}

// Host (organizer) coverage lives in src/components/Host/HostDashboard.test.tsx:
// RequireReviewer keeps that role out of /admin entirely.

describe("AdminOverviewPage", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(authState("admin"));
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultEventsState });
    vi.mocked(useAdminUsers).mockReturnValue({ ...defaultUsersState });
    vi.mocked(useAdminUserCount).mockReturnValue({ ...defaultUserCountState });
    vi.mocked(useOrganizerRequests).mockReturnValue({ ...defaultOrganizerRequestsState });
    vi.mocked(useAdminVenues).mockReturnValue({
      venues: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.mocked(useAdminSubmissions).mockReturnValue({ ...defaultSubmissionsState });
  });

  it("states only the counts that represent work left to do", () => {
    vi.mocked(useAdminSubmissions).mockReturnValue({
      ...defaultSubmissionsState,
      submissions: [submission("s-1", "Unset One", 3), submission("s-2", "Unset Two", 4)],
    });
    vi.mocked(useOrganizerRequests).mockReturnValue({
      ...defaultOrganizerRequestsState,
      pendingCount: 3,
    });
    renderPage();

    expect(countFigure(/entries unset/)).toBe("2");
    expect(countFigure(/organizer requests/)).toBe("3");
    expect(countFigure(/flagged account/)).toBe("1");

    // The retired stat grid reported inventory. The desk reports work only.
    expect(screen.queryByText(/Total Users/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Total Venues/i)).not.toBeInTheDocument();
  });

  it("sets approved upcoming events into the week and leaves everything else out", () => {
    renderPage();

    // event-1 is 10 days out and event-2 is 15, both beyond the seven
    // divisions the column shows, so the week reads as empty rather than
    // silently pulling distant events forward.
    expect(within(column()).getAllByText("Nothing set.")).toHaveLength(7);
    expect(within(column()).queryByText("Pending One")).not.toBeInTheDocument();
    expect(within(column()).queryByText("Past Approved Event")).not.toBeInTheDocument();
  });

  it("positions an approved event on its own night inside the week", () => {
    vi.mocked(useAdminEvents).mockReturnValue({
      ...defaultEventsState,
      events: [{ ...baseEvent, id: "soon", title: "Friday Social", event_date: daysFromNow(2) }],
    });
    renderPage();

    expect(within(column()).getByText("Friday Social")).toBeInTheDocument();
  });

  it("reports a clear galley rather than an empty panel", () => {
    renderPage();

    expect(within(galley()).getByText(/Galley is clear/)).toBeInTheDocument();
  });

  it("lists an unset entry in the galley with its flyer", () => {
    vi.mocked(useAdminSubmissions).mockReturnValue({
      ...defaultSubmissionsState,
      submissions: [submission("s-1", "Unset One", 3)],
    });
    renderPage();

    expect(within(galley()).getByText("Unset One")).toBeInTheDocument();
    expect(within(galley()).getByRole("img", { name: "Awaiting decision" })).toBeInTheDocument();
  });

  it("opens an entry in place instead of routing away", async () => {
    const user = userEvent.setup();
    vi.mocked(useAdminSubmissions).mockReturnValue({
      ...defaultSubmissionsState,
      submissions: [submission("s-1", "Unset One", 3)],
    });
    renderPage();

    await user.click(within(galley()).getByRole("button", { name: "Unset One" }));

    expect(within(galley()).getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(within(galley()).getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("approves an entry through the real mutation", async () => {
    const approveSubmissionWithTaxonomy = vi.fn();
    const user = userEvent.setup();
    vi.mocked(useAdminSubmissions).mockReturnValue({
      ...defaultSubmissionsState,
      submissions: [submission("s-1", "Unset One", 3)],
      approveSubmissionWithTaxonomy,
    });
    renderPage();

    await user.click(within(galley()).getByRole("button", { name: "Unset One" }));
    await user.click(within(galley()).getByRole("button", { name: "Approve" }));

    expect(approveSubmissionWithTaxonomy).toHaveBeenCalledWith(
      { submissionId: "s-1", taxonomyTermIds: [] },
      expect.anything()
    );
  });

  it("saves reviewed linked records before approving inline, and approves nothing if saving fails", async () => {
    const user = userEvent.setup();
    const base = submission("s-1", "Unset One", 3) as { submitted_data: Record<string, unknown> };
    const VENUE_ID = "11111111-1111-4111-8111-111111111111";
    const withReview = {
      ...base,
      edited_data: null,
      submitted_data: {
        ...base.submitted_data,
        entity_review: {
          venue: {
            candidate: { name: "Studio 5" },
            state: "POSSIBLE MATCH",
            matches: [{ id: VENUE_ID, name: "Studio Five" }],
            decision: "new",
            selected_id: null,
          },
          organizer: null,
          instructors: [],
          school: null,
        },
      },
    };
    const order: string[] = [];
    let saved!: { onSuccess?: () => void; onError?: (error: Error) => void };
    const updateSubmission = vi.fn((_vars: unknown, callbacks: typeof saved) => {
      order.push("update");
      saved = callbacks;
    });
    const approveSubmissionWithTaxonomy = vi.fn(() => {
      order.push("approve");
    });
    vi.mocked(useAdminSubmissions).mockReturnValue({
      ...defaultSubmissionsState,
      submissions: [withReview],
      updateSubmission,
      approveSubmissionWithTaxonomy,
    });
    renderPage();

    await user.click(within(galley()).getByRole("button", { name: "Unset One" }));
    await user.click(within(galley()).getByRole("button", { name: "Use Studio Five as the venue" }));
    await user.click(within(galley()).getByRole("button", { name: "Approve" }));

    expect(approveSubmissionWithTaxonomy).not.toHaveBeenCalled();
    expect(updateSubmission).toHaveBeenCalledWith(
      {
        id: "s-1",
        update: {
          edited_data: {
            entity_review: expect.objectContaining({
              venue: expect.objectContaining({ decision: "existing", selected_id: VENUE_ID }),
            }),
          },
        },
      },
      expect.anything()
    );

    saved.onError?.(new Error("nope"));
    expect(approveSubmissionWithTaxonomy).not.toHaveBeenCalled();
    saved.onSuccess?.();
    expect(order).toEqual(["update", "approve"]);
  });
it("keeps an approval failure open without starting the leave animation", async () => {
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
  await act(async () => {
    callbacks.onError?.(new Error("Approval failed"));
  });

  const entry = within(galley()).getByRole("button", { name: "Unset One" }).closest("li");
  expect(entry).not.toHaveAttribute("data-leaving");
  expect(within(galley()).getByText("Approval failed")).toBeInTheDocument();
  expect(within(column()).queryByText("Unset One")).not.toBeInTheDocument();
});

it("focuses the next unresolved entry after a successful approval", async () => {
  const user = userEvent.setup();
  let callbacks!: { onSuccess?: () => void; onError?: (error: Error) => void };
  const approveSubmissionWithTaxonomy = vi.fn(
    (_payload, receivedCallbacks) => {
      callbacks = receivedCallbacks;
    }
  );
  vi.mocked(useAdminSubmissions).mockReturnValue({
    ...defaultSubmissionsState,
    submissions: [submission("s-1", "Unset One", 3), submission("s-2", "Unset Two", 4)],
    approveSubmissionWithTaxonomy,
  });
  renderPage();

  await user.click(within(galley()).getByRole("button", { name: "Unset One" }));
  await user.click(within(galley()).getByRole("button", { name: "Approve" }));
  await act(async () => {
    callbacks.onSuccess?.();
    const { promise, resolve } = Promise.withResolvers<void>();
    window.setTimeout(resolve, 450);
    await promise;
  });

  expect(within(galley()).queryByRole("button", { name: "Unset One" })).not.toBeInTheDocument();
  expect(within(column()).getByText("Unset One")).toBeInTheDocument();
  expect(within(galley()).getByRole("button", { name: "Unset Two" })).toHaveFocus();
});

  it("shows an error with a working retry when the week fails to load", async () => {
    const refetch = vi.fn();
    const user = userEvent.setup();
    vi.mocked(useAdminEvents).mockReturnValue({
      ...defaultEventsState,
      events: undefined,
      error: "network down",
      refetch,
    });
    renderPage();

    await user.click(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("reports loading without collapsing the desk", () => {
    vi.mocked(useAdminEvents).mockReturnValue({
      ...defaultEventsState,
      isLoading: true,
      events: undefined,
    });
    renderPage();

    expect(screen.getByRole("region", { name: "Galley" })).toBeInTheDocument();
    expect(column().querySelector("[aria-busy='true']")).toBeInTheDocument();
  });

  it("gives a moderator the same desk without create-event or flagged accounts", () => {
    vi.mocked(useAuth).mockReturnValue(authState("moderator"));
    renderPage();

    expect(galley()).toBeInTheDocument();
    expect(column()).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Create event/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/flagged account/)).not.toBeInTheDocument();
  });

  it("never renders a Host surface for a role that cannot reach /admin", () => {
    vi.mocked(useAuth).mockReturnValue(authState("organizer"));
    renderPage();

    expect(screen.queryByText("Your organizers")).not.toBeInTheDocument();
  });

  it("offers event creation to an admin", () => {
    renderPage();

    expect(screen.getByRole("link", { name: /Create event/ })).toHaveAttribute(
      "href",
      "/admin/events?new=1"
    );
  });
});
