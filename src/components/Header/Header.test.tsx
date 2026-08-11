import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import type { AuthContextValue } from "../../contexts/authContextObject";
import { useAuth } from "../../contexts/useAuth";
import { useCity } from "../../contexts/useCity";
import Header from "./Header";

vi.mock("../../contexts/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../../contexts/useCity", () => ({ useCity: vi.fn() }));

const setCity = vi.fn();
const defaultAuth = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  user: null,
  session: null,
  loading: false,
  isAdmin: false,
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="*" element={<><Header /><main>Destination</main></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Header", () => {
  it("renders the logo home link, exact primary navigation, and guest sign in", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });

    renderHeader();

    expect(screen.getByRole("link", { name: /salsa segura/i })).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("link", { name: "Calendar" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Lessons" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Instructors" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "About" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Contact" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Events" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Sign In" })[0]).toHaveAttribute("href", "/signin");
  });

  it("renders member account disclosure without Admin", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });

    renderHeader();

    const account = screen.getByText("Account").closest("details");
    expect(account).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Submit Event" })[0]).toHaveAttribute("href", "/submit");
    expect(within(account as HTMLElement).getByRole("link", { name: "My Profile" })).toHaveAttribute("href", "/profile");
    expect(within(account as HTMLElement).getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
    expect(screen.queryAllByRole("link", { name: "Admin" })).toHaveLength(0);
  });

  it("renders Admin only for admins", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "admin" } as User, isAdmin: true }));
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });

    renderHeader();

    expect(screen.getAllByRole("link", { name: "Admin" })[0]).toHaveAttribute("href", "/admin");
  });

  it("opens and closes the drawer after a navigation link", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("link", { name: "Calendar" }));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the drawer after a guest action", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(within(document.getElementById("site-navigation") as HTMLElement).getByRole("link", { name: "Sign In" }));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("awaits member sign out and closes the drawer", async () => {
    let resolveSignOut: (() => void) | undefined;
    const signOut = vi.fn(() => new Promise<void>((resolve) => { resolveSignOut = resolve; }));
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User, signOut }));
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(within(document.getElementById("site-navigation") as HTMLElement).getByRole("button", { name: "Sign Out" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    resolveSignOut?.();
    await waitFor(() => expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false"));
  });

  it("closes the drawer with Escape", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });
});
