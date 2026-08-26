import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import type { AdminUserRow } from "../features/admin/model/usersQuery";
import type { AuthContextValue } from "../contexts/authContextObject";
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
const { useMySubmissions } = vi.hoisted(() => ({ useMySubmissions: vi.fn() }));
vi.mock("../hooks/useMySubmissions", () => ({ useMySubmissions }));

vi.mock("../hooks/useAdminEvents", () => ({ useAdminEvents }));
vi.mock("../hooks/useAdminUserCount", () => ({ useAdminUserCount }));
vi.mock("../hooks/useAdminUsers", () => ({ useAdminUsers }));
vi.mock("../features/admin/hooks/useOrganizerRequests", () => ({ useOrganizerRequests }));
vi.mock("../features/admin/hooks/useAdminVenues", () => ({ useAdminVenues }));
vi.mock("../contexts/useAuth", () => ({ useAuth }));

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
    signUp: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
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

function renderPage() {
  return render(<AdminOverviewPage />, { wrapper: MemoryRouter });
}

function metricCard(label: string): HTMLElement {
  return screen
    .getByLabelText(new RegExp(`^${label}:`))
    .closest(".admin-metric-card") as HTMLElement;
}

function attentionSection(): HTMLElement {
  return screen.getByText("Needs attention").closest("section") as HTMLElement;
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
  });

  it("computes the five metric card values from a fixture of known statuses/dates", () => {
    renderPage();

    expect(metricCard("Upcoming Events")).toHaveTextContent("2");
    expect(metricCard("Pending Submissions")).toHaveTextContent("0");
    expect(metricCard("Organizer Requests")).toHaveTextContent("0");
    expect(metricCard("Total Venues")).toHaveTextContent("0");
    expect(metricCard("Total Users")).toHaveTextContent("4");
  });

  it("shows suggested item for incomplete upcoming events", () => {
    renderPage();

    expect(
      screen.getByText(/1 upcoming event missing venue, time, or image/).closest("li")
    ).toBeInTheDocument();
  });

  it("shows the caught-up row when there is nothing to review, flag, or fix", () => {
    vi.mocked(useAdminEvents).mockReturnValue({
      ...defaultEventsState,
      events: events.filter((event) => event.id === "event-1"),
    });
    vi.mocked(useAdminUsers).mockReturnValue({
      ...defaultUsersState,
      users: [baseUser],
    });
    renderPage();

    expect(within(attentionSection()).getByText(/You're all caught up/)).toBeInTheDocument();
    expect(within(attentionSection()).queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("shows a section-level error with a working Try Again", async () => {
    const refetch = vi.fn();
    vi.mocked(useAdminEvents).mockReturnValue({
      ...defaultEventsState,
      events: undefined,
      error: "network down",
      refetch,
    });
    renderPage();

    const banners = screen.getAllByRole("alert");
    expect(banners.length).toBeGreaterThan(0);
    for (const banner of banners) {
      within(banner).getByRole("button", { name: "Try Again" }).click();
    }
    expect(refetch).toHaveBeenCalled();
  });

  it("keeps cards 1-5 and both sections rendered when only the user-count query fails", () => {
    vi.mocked(useAdminUserCount).mockReturnValue({
      count: undefined,
      isLoading: false,
      error: "profiles unreachable",
      refetch: vi.fn(),
    });
    renderPage();

    expect(metricCard("Pending Submissions")).toHaveTextContent("0");
    expect(metricCard("Organizer Requests")).toHaveTextContent("0"); // organizer_requests table is wired via useOrganizerRequests
    expect(metricCard("Total Users")).toHaveTextContent("—");
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Upcoming events")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("shows a loading status while fetching", () => {
    vi.mocked(useAdminEvents).mockReturnValue({
      ...defaultEventsState,
      isLoading: true,
      events: undefined,
    });
    renderPage();

    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("surfaces pending organizer requests in Needs Attention", () => {
    vi.mocked(useOrganizerRequests).mockReturnValue({
      ...defaultOrganizerRequestsState,
      pendingCount: 3,
    });
    renderPage();

    expect(metricCard("Organizer Requests")).toHaveTextContent("3");
    expect(
      within(attentionSection()).getByText(/3 organizer requests? waiting for review/)
    ).toBeInTheDocument();
  });

  it("renders the moderator dashboard with moderation KPIs when role is moderator", () => {
    vi.mocked(useAuth).mockReturnValue(authState("moderator"));
    renderPage();

    expect(screen.getByRole("heading", { name: "Moderator Dashboard" })).toBeInTheDocument();
    expect(metricCard("Flagged Users")).toBeInTheDocument();
    expect(metricCard("Pending Submissions")).toBeInTheDocument();
    expect(metricCard("Organizer Requests")).toBeInTheDocument();
    expect(metricCard("Upcoming Events")).toBeInTheDocument();
    // Moderator dashboard does not show Total Users (admin-only)
    expect(screen.queryByText("Total Users")).not.toBeInTheDocument();
  });

  it("never renders a Host surface for a role that cannot reach /admin", () => {
    vi.mocked(useAuth).mockReturnValue(authState("organizer"));
    renderPage();

    expect(screen.queryByRole("heading", { name: "Host dashboard" })).not.toBeInTheDocument();
  });

  it("renders the full admin dashboard by default (admin role)", () => {
    vi.mocked(useAuth).mockReturnValue(authState("admin"));
    renderPage();

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(metricCard("Total Users")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Upcoming events")).toBeInTheDocument();
  });
});
