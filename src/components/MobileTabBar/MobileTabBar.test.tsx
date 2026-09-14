import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AuthContextValue } from "../../contexts/authContextObject";
import { useAuth } from "../../contexts/useAuth";
import MobileTabBar from "./MobileTabBar";

vi.mock("../../contexts/useAuth", () => ({ useAuth: vi.fn() }));

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
  updateEmail: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  clearDeletedAccount: vi.fn(),
  ...overrides,
});

function renderTabBar(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <MobileTabBar />
    </MemoryRouter>
  );
}

describe("MobileTabBar", () => {
  it("renders Home, Calendar, and Me as the three primary destinations", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    renderTabBar();

    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/calendar");
  });

  it("routes the Me tab to sign in when signed out", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: null }));
    renderTabBar();

    expect(screen.getByRole("link", { name: "Me" })).toHaveAttribute("href", "/signin");
  });

  it("routes the Me tab to the profile when signed in", () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "user-1" } as AuthContextValue["user"] })
    );
    renderTabBar();

    expect(screen.getByRole("link", { name: "Me" })).toHaveAttribute("href", "/profile");
  });

  it("marks the active route current", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    renderTabBar("/calendar");

    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });
});

describe("MobileTabBar event creation", () => {
  it("stays out of the tab bar for every role", () => {
    for (const auth of [
      defaultAuth(),
      defaultAuth({ user: { id: "member-1" } as AuthContextValue["user"] }),
      defaultAuth({
        user: { id: "mod-1" } as AuthContextValue["user"],
        role: "moderator",
        isModerator: true,
      }),
      defaultAuth({
        user: { id: "admin-1" } as AuthContextValue["user"],
        role: "admin",
        isAdmin: true,
      }),
    ]) {
      vi.mocked(useAuth).mockReturnValue(auth);
      const { unmount } = renderTabBar();

      expect(screen.queryByRole("link", { name: "Submit" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Add" })).not.toBeInTheDocument();

      unmount();
    }
  });
});
