import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import type { AuthContextValue } from "../../contexts/authContextObject";
import { useAuth } from "../../contexts/useAuth";
import { useCity } from "../../contexts/useCity";
import { useOwnProfile } from "../../hooks/useOwnProfile";
import Header from "./Header";

vi.mock("../../contexts/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../../contexts/useCity", () => ({ useCity: vi.fn() }));
vi.mock("../../hooks/useOwnProfile", () => ({ useOwnProfile: vi.fn() }));

const setCity = vi.fn();
const defaultAuth = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  user: null,
  session: null,
  loading: false,
  role: null,
  isAdmin: false,
  isModerator: false,
  isOrganizer: false,
  signInWithPassword: vi.fn(),
  resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  clearDeletedAccount: vi.fn(),
  ...overrides,
});

const defaultProfileQuery = () => ({
  profile: null,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
});

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <Header />
              <main>Destination</main>
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("Header", () => {
  beforeEach(() => {
    vi.mocked(useOwnProfile).mockReturnValue(defaultProfileQuery());
  });

  it("renders the logo home link, exact primary navigation, and guest sign in", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });

    renderHeader();

    expect(screen.getByRole("link", { name: /salsa segura/i })).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("link", { name: "Calendar" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Lessons" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Instructors" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "About" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Contact" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Events" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Sign In" })[0]).toHaveAttribute("href", "/signin");
  });

  it("renders member account disclosure without Dashboard", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });

    renderHeader();

    const account = screen.getByLabelText("Open account menu").closest("details");
    expect(account).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Submit Event" })[0]).toHaveAttribute(
      "href",
      "/submit"
    );
    expect(
      within(account as HTMLElement).getByRole("link", { name: "My Profile" })
    ).toHaveAttribute("href", "/profile");
    expect(
      within(account as HTMLElement).getByRole("button", { name: "Sign Out" })
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("link", { name: "Dashboard" })).toHaveLength(0);
  });

  it("renders Dashboard for reviewers (admin or moderator)", () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "admin" } as User, isAdmin: true, isModerator: true })
    );
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });

    renderHeader();

    expect(screen.getAllByRole("link", { name: "Dashboard" })[0]).toHaveAttribute("href", "/admin");
  });

  it("renders no DASHBOARDS section for a guest", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });

    renderHeader();

    expect(screen.queryByText("Dashboards")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Host Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("renders no DASHBOARDS section for a regular authenticated user with no role", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });

    renderHeader();

    expect(screen.queryByText("Dashboards")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Host Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("renders Host Dashboard for organizers in both desktop and mobile blocks", async () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "organizer" } as User, isOrganizer: true })
    );
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    const user = userEvent.setup();
    renderHeader();

    const desktopAccount = screen
      .getByLabelText("Open account menu")
      .closest("details") as HTMLElement;
    expect(within(desktopAccount).getByRole("link", { name: "Host Dashboard" })).toHaveAttribute(
      "href",
      "/host"
    );

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("site-navigation") as HTMLElement;
    const mobileAccount = within(drawer).getByRole("region", { name: "Account" });
    expect(within(mobileAccount).getByRole("link", { name: "Host Dashboard" })).toHaveAttribute(
      "href",
      "/host"
    );
  });

  it("removes dashboard links after sign out", async () => {
    const signOutResult = Promise.withResolvers<{ error: null }>();
    const signOut = vi.fn(() => signOutResult.promise);
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "moderator" } as User, isModerator: true, signOut })
    );
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    const user = userEvent.setup();
    const { rerender } = renderHeader();

    expect(screen.getAllByRole("link", { name: "Dashboard" }).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: "Sign Out" })[0]);
    expect(signOut).toHaveBeenCalledWith("global");
    signOutResult.resolve({ error: null });

    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <Header />
                <main>Destination</main>
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument()
    );
  });

  it("opens and closes the drawer after a navigation link", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    await user.click(screen.getByRole("link", { name: "Calendar" }));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("closes the drawer after a guest action", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(
      within(document.getElementById("site-navigation") as HTMLElement).getByRole("link", {
        name: "Sign In",
      })
    );
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("awaits member sign out and closes the drawer", async () => {
    const signOutResult = Promise.withResolvers<{ error: null }>();
    const signOut = vi.fn(() => signOutResult.promise);
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User, signOut }));
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(
      within(document.getElementById("site-navigation") as HTMLElement).getByRole("button", {
        name: "Sign Out",
      })
    );
    expect(signOut).toHaveBeenCalledWith("global");
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    signOutResult.resolve({ error: null });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
        "aria-expanded",
        "false"
      )
    );
  });

  it("closes the drawer with Escape", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
  it("groups signed-out mobile navigation into destinations, city, and account actions", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("site-navigation") as HTMLElement;
    const city = within(drawer).getByRole("region", { name: "Your city" });
    const account = within(drawer).getByRole("region", { name: "Account" });

    expect(within(drawer).getByText("Explore Salsa Segura")).toBeInTheDocument();
    expect(within(account).getByRole("link", { name: "Submit Event" })).toHaveClass("auth-btn");
    expect(within(account).getByRole("link", { name: "Sign In" })).toHaveAttribute(
      "href",
      "/signin"
    );
    expect(within(city).getByRole("button", { name: "BOS" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("keeps member and moderator actions inside the mobile account group", async () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "moderator" } as User, isModerator: true })
    );
    vi.mocked(useCity).mockReturnValue({ city: "new-york-city", setCity });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("site-navigation") as HTMLElement;
    const account = within(drawer).getByRole("region", { name: "Account" });
    const city = within(drawer).getByRole("region", { name: "Your city" });

    expect(within(account).getByRole("link", { name: "My Profile" })).toHaveAttribute(
      "href",
      "/profile"
    );
    expect(within(account).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/admin"
    );
    expect(within(account).getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
    expect(within(city).getByRole("button", { name: "NYC" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
  it("uses rose-red CTA only for Submit Event and quiet secondary style for Sign In", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("site-navigation") as HTMLElement;
    const account = within(drawer).getByRole("region", { name: "Account" });

    expect(within(account).getByRole("link", { name: "Submit Event" })).toHaveClass("auth-btn");
    expect(within(account).getByRole("link", { name: "Sign In" })).not.toHaveClass("auth-btn");
  });

  it("shows the profile photo inside the account menu trigger when avatar_url is set", () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "member", email: "member@example.com" } as User })
    );
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    vi.mocked(useOwnProfile).mockReturnValue({
      ...defaultProfileQuery(),
      profile: {
        id: "member",
        display_name: "Sofia Martinez",
        username: "sofia",
        avatar_url: "https://example.com/sofia.jpg",
        status: "active",
        status_reason: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    });

    renderHeader();
    const trigger = screen.getByLabelText("Open account menu");
    const img = trigger.querySelector("img.account-avatar");
    expect(img).toHaveAttribute("src", "https://example.com/sofia.jpg");
  });

  it("falls back to display_name initials when there is no avatar_url", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    vi.mocked(useOwnProfile).mockReturnValue({
      ...defaultProfileQuery(),
      profile: {
        id: "member",
        display_name: "Sofia Martinez",
        username: null,
        avatar_url: null,
        status: "active",
        status_reason: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    });

    renderHeader();

    const trigger = screen.getByLabelText("Open account menu");
    expect(trigger.querySelector("img")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("SM");
  });

  it("falls back through username then email when display_name is missing", () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "member", email: "dancefan@example.com" } as User })
    );
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    vi.mocked(useOwnProfile).mockReturnValue({
      ...defaultProfileQuery(),
      profile: {
        id: "member",
        display_name: null,
        username: "@sofia",
        avatar_url: null,
        status: "active",
        status_reason: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    });

    const { rerender } = renderHeader();
    expect(screen.getByLabelText("Open account menu")).toHaveTextContent("S");

    vi.mocked(useOwnProfile).mockReturnValue({
      ...defaultProfileQuery(),
      profile: {
        id: "member",
        display_name: null,
        username: null,
        avatar_url: null,
        status: "active",
        status_reason: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    });
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <Header />
                <main>Destination</main>
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByLabelText("Open account menu")).toHaveTextContent("D");
  });

  it("exposes 'Open account menu' as the accessible name, not the initials text", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    vi.mocked(useOwnProfile).mockReturnValue({
      ...defaultProfileQuery(),
      profile: {
        id: "member",
        display_name: "Roosevelt",
        username: null,
        avatar_url: null,
        status: "active",
        status_reason: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    });

    renderHeader();

    const trigger = screen.getByLabelText("Open account menu");
    expect(trigger.tagName).toBe("SUMMARY");
    expect(screen.queryByLabelText("R")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "R" })).not.toBeInTheDocument();
  });

  it("still reveals My Account, My Profile, and Sign Out when the avatar trigger is open", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });

    renderHeader();

    const details = screen.getByLabelText("Open account menu").closest("details") as HTMLDetailsElement;
    details.open = true;

    expect(within(details).getByRole("link", { name: "My Account" })).toHaveAttribute(
      "href",
      "/account"
    );
    expect(within(details).getByRole("link", { name: "My Profile" })).toHaveAttribute(
      "href",
      "/profile"
    );
    expect(within(details).getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
  });
});
