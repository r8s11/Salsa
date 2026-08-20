import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    submissions: [] as DatabaseEvent[],
    approvedEvents: [] as DatabaseEvent[],
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
  id: "boston-approved",
  title: "Boston Social",
  description: null,
  event_type: "social",
  event_date: "2026-08-20T20:00:00Z",
  event_time: null,
  location: null,
  address: null,
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: null,
  submitter_name: null,
  submitter_email: null,
  submitter_id: "user-1",
  status: "approved",
  city: "boston",
  created_at: "2026-08-01T00:00:00Z",
  host: null,
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  source_type: "user_submission",
  taxonomy_term_ids: [],
  taxonomy_terms: [],
  updated_at: "2026-08-01T00:00:00Z",
  cancellation_reason: null,
  venue_id: null,
};
const nycApproved: DatabaseEvent = {
  ...bostonApproved,
  id: "nyc-approved",
  title: "NYC Workshop",
  event_type: "workshop",
  city: "new-york-city",
};
const pending: DatabaseEvent = {
  ...bostonApproved,
  id: "pending",
  title: "Pending Class",
  event_type: "class",
  status: "pending",
};
const rejected: DatabaseEvent = {
  ...bostonApproved,
  id: "rejected",
  title: "Rejected Social",
  status: "rejected",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "user-1", email: "dancer@example.com" };
    mocks.submissions = {
      submissions: [pending, rejected],
      approvedEvents: [bostonApproved, nycApproved],
      isLoading: false,
      error: null,
    };
  });

  it("shows profile identity and actions", () => {
    renderPage();

    expect(screen.getByText("dancer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Submit Event" })).toHaveAttribute("href", "/submit");
    expect(screen.getByRole("link", { name: "View Calendar" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
  });

  it("shows stats derived from submissions", () => {
    renderPage();

    expect(screen.getByText("Events Hosted")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Total Submissions")).toBeInTheDocument();
  });

  it("shows all submissions in a list", () => {
    renderPage();

    expect(screen.getByText("Boston Social")).toBeInTheDocument();
    expect(screen.getByText("NYC Workshop")).toBeInTheDocument();
    expect(screen.getByText("Pending Class")).toBeInTheDocument();
    expect(screen.getByText("Rejected Social")).toBeInTheDocument();
  });

  it("shows View on calendar link for approved submissions", () => {
    renderPage();

    const links = screen.getAllByText("View on calendar");
    expect(links).toHaveLength(2);
    expect(links[0].closest("a")).toHaveAttribute("href", "/calendar?event=boston-approved&city=boston");
    expect(links[1].closest("a")).toHaveAttribute("href", "/calendar?event=nyc-approved&city=new-york-city");
  });

  it("shows Edit link for pending and rejected submissions", () => {
    renderPage();

    const editLinks = screen.getAllByText("Edit");
    expect(editLinks).toHaveLength(2);
    expect(editLinks[0].closest("a")).toHaveAttribute("href", "/profile/edit/pending");
    expect(editLinks[1].closest("a")).toHaveAttribute("href", "/profile/edit/rejected");
  });

  it("shows loading state", () => {
    mocks.submissions = { submissions: [], approvedEvents: [], isLoading: true, error: null };
    renderPage();
    expect(screen.getByText("Loading profile…")).toBeInTheDocument();
  });

  it("shows error state with retry", () => {
    mocks.submissions = { submissions: [], approvedEvents: [], isLoading: false, error: "Network error" };
    renderPage();
    expect(screen.getByText("Couldn't load your profile: Network error")).toBeInTheDocument();
  });

  it("shows empty state when no submissions", () => {
    mocks.submissions = { submissions: [], approvedEvents: [], isLoading: false, error: null };
    renderPage();
    expect(screen.getByText(/You haven't submitted any events yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submit one" })).toHaveAttribute("href", "/submit");
  });

  it("does not show Edit link for approved submissions", () => {
    renderPage();

    const editLinks = screen.getAllByText("Edit");
    expect(editLinks).toHaveLength(2);
  });
});
