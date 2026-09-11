import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DatabaseEvent } from "../../features/events/model/types";
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
  ownProfile: {
    profile: null as unknown,
    isLoading: false,
    error: null as string | null,
    refetch: vi.fn(),
  },
}));

vi.mock("../../contexts/useAuth", () => ({
  useAuth: () => ({ ...mocks.auth, signOut: mocks.signOut }),
}));

vi.mock("../../features/account/hooks/useMySubmissions", () => ({
  useMySubmissions: () => ({ ...mocks.submissions, refetch: mocks.refetch }),
}));

vi.mock("../../features/account/hooks/useOwnProfile", () => ({
  useOwnProfile: () => mocks.ownProfile,
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
    mocks.ownProfile.profile = null;
    mocks.ownProfile.isLoading = false;
    mocks.ownProfile.error = null;
  });

  it("shows profile identity and actions", () => {
    renderPage();

    expect(screen.getByText("dancer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Submit Event" })).toHaveAttribute("href", "/submit");
    expect(screen.getByRole("link", { name: "View Calendar" })).toHaveAttribute(
      "href",
      "/calendar"
    );
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
    expect(links[0].closest("a")).toHaveAttribute(
      "href",
      "/calendar?event=boston-approved&city=boston"
    );
    expect(links[1].closest("a")).toHaveAttribute(
      "href",
      "/calendar?event=nyc-approved&city=new-york-city"
    );
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
    mocks.submissions = {
      submissions: [],
      approvedEvents: [],
      isLoading: false,
      error: "Network error",
    };
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

  // ---- Phase 6 correction ----
  // /profile is where the editor returns after saving, so it must show the
  // persisted profile row, not the auth metadata. It previously read
  // user_metadata.full_name, so a saved display_name never appeared here.

  function savedProfile(overrides: Record<string, unknown> = {}) {
    return {
      id: "user-1",
      display_name: "Maria Santos",
      username: "mariasalsa",
      avatar_url: null,
      status: "active",
      status_reason: null,
      created_at: "2026-01-15T00:00:00Z",
      ...overrides,
    };
  }

  it("shows the saved display name from the profile row", () => {
    mocks.ownProfile.profile = savedProfile();
    renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Maria Santos");
    expect(screen.queryByText("dancer")).not.toBeInTheDocument();
  });

  it("renders the saved photo with referrers suppressed", () => {
    mocks.ownProfile.profile = savedProfile({ avatar_url: "https://cdn.test/maria.png" });
    renderPage();

    const img = screen.getByRole("presentation", { hidden: true }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://cdn.test/maria.png");
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("falls back to initials when the saved photo fails to load", () => {
    mocks.ownProfile.profile = savedProfile({ avatar_url: "https://cdn.test/gone.png" });
    const { container } = renderPage();

    fireEvent.error(screen.getByRole("presentation", { hidden: true }));

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("attempts a fresh load when the saved photo URL changes after a failure", () => {
    mocks.ownProfile.profile = savedProfile({ avatar_url: "https://cdn.test/gone.png" });
    const { container, rerender } = renderPage();

    fireEvent.error(screen.getByRole("presentation", { hidden: true }));
    expect(container.querySelector("img")).toBeNull();

    mocks.ownProfile.profile = savedProfile({ avatar_url: "https://cdn.test/fresh.png" });
    rerender(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("https://cdn.test/fresh.png");
  });

  it("never assigns a stored photo value the save path would reject", () => {
    mocks.ownProfile.profile = savedProfile({ avatar_url: "https://user:pass@cdn.test/x.png" });
    const { container } = renderPage();

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("keeps the existing email-derived fallback when no profile row exists", () => {
    mocks.ownProfile.profile = null;
    renderPage();

    expect(screen.getByText("dancer")).toBeInTheDocument();
  });
});
