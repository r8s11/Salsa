import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AccountPage from "./AccountPage";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "user-1", email: "maria@example.com" } as { id: string; email: string } | null,
    role: null as "admin" | "moderator" | "organizer" | null,
    signOut: vi.fn(),
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

function CurrentLocation() {
  const { pathname } = useLocation();
  return <output data-testid="location">{pathname}</output>;
}

function renderPage(initialPath = "/account") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/account" element={<AccountPage />} />
        <Route
          path="/"
          element={
            <>
              <p>Signed out destination</p>
              <CurrentLocation />
            </>
          }
        />
      </Routes>
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
    mocks.auth.signOut.mockReset();
    mocks.auth.signOut.mockResolvedValue({ error: null });
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
    expect(screen.getAllByText(/maria@example\.com/)).toHaveLength(2);
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
    expect(screen.getAllByText(/maria@example\.com/)).toHaveLength(2);
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

  it.each([null, "organizer", "moderator", "admin"] as const)(
    "renders Security & sessions for the %s account role",
    (role) => {
      mocks.auth.role = role;
      mocks.profile.profile = baseProfile();
      renderPage();

      expect(screen.getByRole("heading", { level: 2, name: "Security & sessions" })).toBeInTheDocument();
    }
  );

  it("shows only truthful current-session facts and rejects prototype session data", () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    const section = screen.getByRole("region", { name: "Security & sessions" });
    expect(section).toHaveTextContent("This browser");
    expect(section).toHaveTextContent("Current");
    expect(section).toHaveTextContent("Signed in as maria@example.com");
    expect(screen.getByRole("button", { name: "Sign out on this device" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out other devices" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out everywhere" })).toBeInTheDocument();
    expect(section).not.toHaveTextContent(/iPhone 15|MacBook Pro|Boston|New York City|Last active/i);
  });

  it("keeps the current-session controls available when an authenticated account has no profile row", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 2, name: "Security & sessions" })).toBeInTheDocument();
    expect(screen.getByText("Signed in as maria@example.com")).toBeInTheDocument();
  });

  it("uses a local sign-out, prevents duplicates, and replaces the account route on success", async () => {
    const signOut = Promise.withResolvers<{ error: null }>();
    mocks.profile.profile = baseProfile();
    mocks.auth.signOut.mockReturnValue(signOut.promise);
    const user = userEvent.setup();
    renderPage();

    const action = screen.getByRole("button", { name: "Sign out on this device" });
    await user.click(action);
    await user.click(action);

    expect(mocks.auth.signOut).toHaveBeenCalledOnce();
    expect(mocks.auth.signOut).toHaveBeenCalledWith("local");
    expect(screen.getByRole("button", { name: "Signing out on this device" })).toBeDisabled();

    signOut.resolve({ error: null });

    await waitFor(() => expect(screen.getByText("Signed out destination")).toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("keeps the authenticated account page recoverable when local sign-out fails", async () => {
    mocks.profile.profile = baseProfile();
    mocks.auth.signOut.mockResolvedValue({ error: new Error("Network unavailable") });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Sign out on this device" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't sign you out on this device. Please try again."
    );
    expect(screen.getByRole("heading", { level: 2, name: "Security & sessions" })).toBeInTheDocument();
    expect(screen.queryByText("Signed out destination")).not.toBeInTheDocument();
  });

  it("requires confirmation before global sign-out and describes access-token expiry honestly", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Sign out everywhere" }));

    expect(mocks.auth.signOut).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Sign out everywhere?" });
    expect(dialog).toHaveTextContent(
      "People using another device may keep access until their current access token expires."
    );
    const cancel = within(dialog).getByRole("button", { name: "Cancel sign out everywhere" });
    const confirm = within(dialog).getByRole("button", { name: "Confirm sign out everywhere" });
    expect(cancel).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out everywhere" })).toHaveFocus();
  });

  it("uses global sign-out only after confirmation and replaces the account route on success", async () => {
    const signOut = Promise.withResolvers<{ error: null }>();
    mocks.profile.profile = baseProfile();
    mocks.auth.signOut.mockReturnValue(signOut.promise);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    const dialog = screen.getByRole("dialog", { name: "Sign out everywhere?" });
    const confirm = within(dialog).getByRole("button", { name: "Confirm sign out everywhere" });
    await user.click(confirm);
    await user.click(confirm);

    expect(mocks.auth.signOut).toHaveBeenCalledOnce();
    expect(mocks.auth.signOut).toHaveBeenCalledWith("global");
    expect(within(dialog).getByRole("button", { name: "Signing out everywhere" })).toBeDisabled();

    signOut.resolve({ error: null });

    await waitFor(() => expect(screen.getByText("Signed out destination")).toBeInTheDocument());
  });

  it("keeps global sign-out confirmation recoverable when the request fails", async () => {
    mocks.profile.profile = baseProfile();
    mocks.auth.signOut.mockResolvedValue({ error: new Error("Network unavailable") });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    const dialog = screen.getByRole("dialog", { name: "Sign out everywhere?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm sign out everywhere" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "We couldn't sign you out everywhere. Please try again."
    );
    expect(within(dialog).getByRole("button", { name: "Confirm sign out everywhere" })).toBeEnabled();
    expect(screen.queryByText("Signed out destination")).not.toBeInTheDocument();
  });

  it("uses other-session sign-out without clearing the current account route", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Sign out other devices" }));

    expect(mocks.auth.signOut).toHaveBeenCalledWith("others");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Other sessions were ended. Their current access may continue until each access token expires."
    );
    expect(screen.getByRole("heading", { level: 2, name: "Security & sessions" })).toBeInTheDocument();
    expect(screen.queryByText("Signed out destination")).not.toBeInTheDocument();
  });

  it("reports other-session sign-out failures without claiming success", async () => {
    mocks.profile.profile = baseProfile();
    mocks.auth.signOut.mockResolvedValue({ error: new Error("Network unavailable") });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Sign out other devices" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't sign out your other devices. Please try again."
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
