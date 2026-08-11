import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import ProfilePage from "./ProfilePage";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  refetch: vi.fn(),
  auth: {
    user: { id: "user-1", email: "dancer@example.com" } as { id: string; email: string } | null,
  },
  submissions: {
    submissions: undefined as DatabaseEvent[] | undefined,
    isLoading: false,
    error: null as string | null,
  },
}));

vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({ ...mocks.auth, signOut: mocks.signOut }),
}));

vi.mock("../hooks/useMySubmissions", () => ({
  useMySubmissions: () => ({ ...mocks.submissions, refetch: mocks.refetch }),
}));

const bostonApproved: DatabaseEvent = {
  id: "boston-approved", title: "Boston Social", description: null, event_type: "social",
  event_date: "2026-08-20T20:00:00Z", event_time: null, location: null, address: null,
  price_type: "free", price_amount: null, rsvp_link: null, image_url: null,
  submitter_name: null, submitter_email: null, submitter_id: "user-1", status: "approved",
  city: "boston", created_at: "2026-08-01T00:00:00Z", host: null, recurrence: null, gallery: null,
  contact_email: null, contact_instagram: null, contact_website: null,
  source_type: "user_submission", dance_styles: [], updated_at: "2026-08-01T00:00:00Z", cancellation_reason: null,
};
const nycApproved: DatabaseEvent = { ...bostonApproved, id: "nyc-approved", title: "NYC Workshop", event_type: "workshop", city: "new-york-city" };
const pending: DatabaseEvent = { ...bostonApproved, id: "pending", title: "Pending Class", event_type: "class", status: "pending" };
const rejected: DatabaseEvent = { ...bostonApproved, id: "rejected", title: "Rejected Social", status: "rejected" };

function renderPage() {
  return render(<MemoryRouter><ProfilePage /></MemoryRouter>);
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "user-1", email: "dancer@example.com" };
    mocks.submissions = { submissions: [bostonApproved, nycApproved, pending, rejected], isLoading: false, error: null };
  });

  it("shows account identity and account actions", () => {
    renderPage();

    expect(screen.getByText("dancer@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submit an Event" })).toHaveAttribute("href", "/submit");
    expect(screen.getByRole("link", { name: "View Calendar" })).toHaveAttribute("href", "/calendar");
    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("shows loading, load error retry, and the global empty submission CTA", () => {
    mocks.submissions = { submissions: undefined, isLoading: true, error: null };
    const { rerender } = renderPage();
    expect(screen.getByText("Loading your submissions...")).toBeInTheDocument();

    mocks.submissions = { submissions: undefined, isLoading: false, error: "Network error" };
    rerender(<MemoryRouter><ProfilePage /></MemoryRouter>);
    expect(screen.getByText("Couldn't load your submissions: Network error")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();

    mocks.submissions = { submissions: [], isLoading: false, error: null };
    rerender(<MemoryRouter><ProfilePage /></MemoryRouter>);
    expect(screen.getByText(/You haven't submitted any events yet\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submit one" })).toHaveAttribute("href", "/submit");
  });

  it("derives status totals and filters visible submissions", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "All 4" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Pending 1" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Approved 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejected 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pending 1" }));
    expect(screen.getByRole("button", { name: "Pending 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Pending Class")).toBeInTheDocument();
    expect(screen.queryByText("Boston Social")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rejected 1" }));
    expect(screen.getByText("Rejected Social")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View on calendar" })).not.toBeInTheDocument();
  });

  it("keeps filters available and names an empty selected status", () => {
    mocks.submissions = { submissions: [pending], isLoading: false, error: null };
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Approved 0" }));
    expect(screen.getByText("No approved submissions.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Filter submissions by status" })).toBeInTheDocument();
  });

  it("uses city-qualified calendar links for approved submissions", () => {
    renderPage();

    const links = screen.getAllByRole("link", { name: "View on calendar" });
    expect(links[0]).toHaveAttribute("href", "/calendar?event=boston-approved&city=boston");
    expect(links[1]).toHaveAttribute("href", "/calendar?event=nyc-approved&city=new-york-city");
  });
});
