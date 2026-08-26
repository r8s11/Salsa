import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AccountPage from "./AccountPage";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "user-1", email: "maria@example.com" } as { id: string; email: string } | null,
    role: null as "admin" | "moderator" | "organizer" | null,
  },
  profile: {
    profile: null as unknown,
    isLoading: false,
    error: null as string | null,
    refetch: vi.fn(),
  },
}));

vi.mock("../contexts/useAuth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("../hooks/useOwnProfile", () => ({
  useOwnProfile: () => mocks.profile,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>
  );
}

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    display_name: "Maria Santos",
    username: "mariasalsa",
    avatar_url: null,
    status: "active",
    status_reason: null,
    created_at: "2026-03-15T00:00:00Z",
    ...overrides,
  };
}

describe("AccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "user-1", email: "maria@example.com" };
    mocks.auth.role = null;
    mocks.profile.profile = null;
    mocks.profile.isLoading = false;
    mocks.profile.error = null;
  });

  it("renders a single h1 and truthful copy, no Sofia prototype data", () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Account" })).toBeInTheDocument();
    expect(screen.queryByText(/Sofia/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Greater Boston/)).not.toBeInTheDocument();
  });

  it("shows display name, @username, email, member since, and role", () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("@mariasalsa")).toBeInTheDocument();
    expect(screen.getByText(/maria@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/Member since March 2026/)).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
  });

  it("shows the organizer role label for an organizer account", () => {
    mocks.auth.role = "organizer";
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(screen.getByText("Organizer")).toBeInTheDocument();
  });

  it("shows a subtle setup state when username is missing, never a dead link", () => {
    mocks.profile.profile = baseProfile({ username: null });
    renderPage();

    expect(screen.getByText("Username not set")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /username/i })).not.toBeInTheDocument();
  });

  it("falls back to @username as the name and never surfaces email as the display name", () => {
    mocks.profile.profile = baseProfile({ display_name: null, username: "mariasalsa" });
    renderPage();

    expect(screen.getByText("@mariasalsa")).toBeInTheDocument();
    expect(screen.queryByText("maria@example.com", { selector: ".account-page__name" })).not.toBeInTheDocument();
  });

  it("renders an initials avatar fallback when avatar_url is missing", () => {
    mocks.profile.profile = baseProfile({ avatar_url: null });
    renderPage();

    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders the avatar image with decorative alt text when avatar_url exists", () => {
    mocks.profile.profile = baseProfile({ avatar_url: "https://cdn.test/avatar.png" });
    renderPage();

    const img = screen.getByRole("presentation", { hidden: true }) as HTMLImageElement | null;
    const image = img ?? (document.querySelector("img.account-page__avatar") as HTMLImageElement);
    expect(image.getAttribute("src")).toBe("https://cdn.test/avatar.png");
    expect(image.getAttribute("alt")).toBe("");
  });

  it("does not render a status banner for an active account", () => {
    mocks.profile.profile = baseProfile({ status: "active" });
    renderPage();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a contextual banner for a suspended account without exposing status_reason", () => {
    mocks.profile.profile = baseProfile({
      status: "suspended",
      status_reason: "Repeated spam submissions — moderator note",
    });
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Account suspended");
    expect(screen.queryByText(/spam submissions/)).not.toBeInTheDocument();
  });

  it("shows a contextual banner for a flagged account", () => {
    mocks.profile.profile = baseProfile({ status: "flagged" });
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Account flagged for review");
  });

  it("shows a contextual banner for a banned account", () => {
    mocks.profile.profile = baseProfile({ status: "banned" });
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Account banned");
  });

  it("links View Profile to the real /profile route", () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(screen.getByRole("link", { name: "View Profile" })).toHaveAttribute("href", "/profile");
  });

  it("shows a loading skeleton instead of blank or identity content while loading", () => {
    mocks.profile.isLoading = true;
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    expect(screen.queryByRole("link", { name: "View Profile" })).not.toBeInTheDocument();
  });

  it("shows a retry action on load failure without signing the user out", () => {
    mocks.profile.error = "network error";
    renderPage();

    expect(screen.getByText(/couldn't load your account/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("calls refetch when Try Again is clicked after a load failure", async () => {
    mocks.profile.error = "network error";
    renderPage();

    screen.getByRole("button", { name: "Try Again" }).click();
    expect(mocks.profile.refetch).toHaveBeenCalled();
  });

  it("handles an authenticated user with no profile row without crashing", () => {
    mocks.profile.profile = null;
    renderPage();

    expect(screen.getByText(/couldn't find an account profile/i)).toBeInTheDocument();
    expect(screen.getByText(/maria@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("renders only regular-user cards and real destinations for an authenticated user without a special role", () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(screen.getByRole("heading", { level: 2, name: "What you can do" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Profile & Activity" })).toHaveAttribute(
      "href",
      "/profile"
    );
    expect(screen.getByRole("link", { name: "Submit an Event" })).toHaveAttribute("href", "/submit");
    expect(screen.queryByText("Host Events")).not.toBeInTheDocument();
    expect(screen.queryByText("Moderation")).not.toBeInTheDocument();
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
  });

  it("renders truthful Host cards and no Admin or moderation links for organizers", () => {
    mocks.auth.role = "organizer";
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(screen.getByText("Host Events")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Host Dashboard" })).toHaveAttribute("href", "/host");
    expect(screen.getByRole("link", { name: "My Events" })).toHaveAttribute("href", "/host/events");
    expect(screen.queryByRole("link", { name: "Open Moderation Queue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Admin Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByText(/publish directly/i)).not.toBeInTheDocument();
  });

  it("renders only the verified moderation queue for moderators", () => {
    mocks.auth.role = "moderator";
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(screen.getByText("Moderation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Moderation Queue" })).toHaveAttribute(
      "href",
      "/admin/submissions"
    );
    expect(screen.queryByRole("link", { name: "Open Admin Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Host Dashboard" })).not.toBeInTheDocument();
  });

  it("renders Administration for admins without Host access", () => {
    mocks.auth.role = "admin";
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(screen.getByText("Administration")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Admin Dashboard" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Open Host Dashboard" })).not.toBeInTheDocument();
  });

  it("does not render capability cards before profile loading completes", () => {
    mocks.profile.isLoading = true;
    renderPage();

    expect(screen.queryByRole("heading", { level: 2, name: "What you can do" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Admin Dashboard" })).not.toBeInTheDocument();
  });

  it("keeps truthful capability cards visible with the suspended account banner", () => {
    mocks.auth.role = "organizer";
    mocks.profile.profile = baseProfile({ status: "suspended" });
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Account suspended");
    expect(screen.getByRole("link", { name: "Open Host Dashboard" })).toHaveAttribute("href", "/host");
  });

  it("renders a truthful, non-interactive Email & notifications section", () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(
      screen.getByRole("heading", { level: 2, name: "Email & notifications" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/required account and security emails are always sent/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/optional email preferences aren.t available yet/i)
    ).toBeInTheDocument();
  });

  it("never renders a notification toggle, switch, or fake save affordance", () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/preferences saved/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });

  it("does not render the notifications section before profile loading completes", () => {
    mocks.profile.isLoading = true;
    renderPage();

    expect(
      screen.queryByRole("heading", { level: 2, name: "Email & notifications" })
    ).not.toBeInTheDocument();
  });

  it("does not render the notifications section when the profile row is missing", () => {
    mocks.profile.profile = null;
    renderPage();

    expect(
      screen.queryByRole("heading", { level: 2, name: "Email & notifications" })
    ).not.toBeInTheDocument();
  });
});
