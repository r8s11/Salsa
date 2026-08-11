import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import AdminOverviewPage from "./AdminOverviewPage";

const { useAdminEvents, useAdminUserCount } = vi.hoisted(() => ({
  useAdminEvents: vi.fn(),
  useAdminUserCount: vi.fn(),
}));

vi.mock("../hooks/useAdminEvents", () => ({ useAdminEvents }));
vi.mock("../hooks/useAdminUserCount", () => ({ useAdminUserCount }));

// The component derives its metrics from the real clock (`new Date()` inside
// its own useMemo, per the purity-lint-safe pattern), so fixture dates are
// relative to test-run time rather than hardcoded.
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
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
  dance_styles: [],
  updated_at: "2026-08-05T00:00:00.000Z",
  cancellation_reason: null,
};

// Known fixture: 2 approved-future within 30 days (1 complete, 1 missing venue
// -> "incomplete"), 1 approved-past (excluded from both), 2 pending, 1 rejected
// — 6 total. upcomingCount=2, pendingCount=2, incompleteCount=1.
const events: DatabaseEvent[] = [
  baseEvent,
  { ...baseEvent, id: "event-2", title: "Incomplete Future Event", event_date: daysFromNow(15), location: null },
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

const defaultUserCountState = {
  count: 4,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

function renderPage() {
  return render(<AdminOverviewPage />, { wrapper: MemoryRouter });
}

function metricCard(label: string): HTMLElement {
  return screen.getByLabelText(new RegExp(`^${label}:`)).closest(".admin-metric-card") as HTMLElement;
}

function hasAttentionTone(card: HTMLElement): boolean {
  return card.querySelector('[class*="--attention"]') !== null;
}

function attentionSection(): HTMLElement {
  return screen.getByText("Needs attention").closest("section") as HTMLElement;
}

describe("AdminOverviewPage", () => {
  beforeEach(() => {
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultEventsState });
    vi.mocked(useAdminUserCount).mockReturnValue({ ...defaultUserCountState });
  });

  it("computes the four metric card values from a fixture of known statuses/dates", () => {
    renderPage();

    expect(metricCard("Upcoming Events")).toHaveTextContent("2");
    expect(metricCard("Pending Submissions")).toHaveTextContent("2");
    expect(metricCard("Incomplete Events")).toHaveTextContent("1");
    expect(metricCard("Total Users")).toHaveTextContent("4");
  });

  it("gives the pending card attention treatment but leaves a zero-count card informational", () => {
    vi.mocked(useAdminEvents).mockReturnValue({
      ...defaultEventsState,
      events: events.filter((event) => event.status !== "pending"),
    });
    renderPage();

    expect(hasAttentionTone(metricCard("Pending Submissions"))).toBe(false);
    expect(hasAttentionTone(metricCard("Incomplete Events"))).toBe(true);
  });

  it("renders two attention rows in action-before-suggested order", () => {
    renderPage();

    const rows = within(attentionSection()).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Action needed")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/2 event submissions waiting for review/)).toBeInTheDocument();
    expect(within(rows[1]).getByText("Suggested")).toBeInTheDocument();
    expect(within(rows[1]).getByText(/1 upcoming event missing venue, time, or image/)).toBeInTheDocument();
  });

  it("shows the caught-up row when there is nothing to review or fix", () => {
    vi.mocked(useAdminEvents).mockReturnValue({
      ...defaultEventsState,
      events: events.filter((event) => event.id === "event-1"),
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

  it("keeps cards 1-3 and both sections rendered when only the user-count query fails", () => {
    vi.mocked(useAdminUserCount).mockReturnValue({
      count: undefined,
      isLoading: false,
      error: "profiles unreachable",
      refetch: vi.fn(),
    });
    renderPage();

    expect(metricCard("Upcoming Events")).toHaveTextContent("2");
    expect(metricCard("Pending Submissions")).toHaveTextContent("2");
    expect(metricCard("Incomplete Events")).toHaveTextContent("1");
    expect(metricCard("Total Users")).toHaveTextContent("—");
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Upcoming events")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("shows a loading status while fetching", () => {
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultEventsState, isLoading: true, events: undefined });
    renderPage();

    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });
});
