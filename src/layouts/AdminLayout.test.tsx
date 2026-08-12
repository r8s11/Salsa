import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminLayout from "./AdminLayout";
const { useTheme } = vi.hoisted(() => ({ useTheme: vi.fn() }));
vi.mock("../contexts/useTheme", () => ({ useTheme }));

vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "moderator@salsa.test" },
    signOut: vi.fn(),
  }),
}));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>Dashboard content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function renderLayoutAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>Dashboard content</p>} />
          <Route path="users/:id" element={<p>Detail content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.mocked(useTheme).mockReturnValue({
      theme: "system",
      effectiveTheme: "light",
      setTheme: vi.fn(),
    });
  });

  it("toggles aria-expanded on the burger button", async () => {
    const user = userEvent.setup();
    renderLayout();

    const burger = screen.getByRole("button", { name: "Open navigation" });
    expect(burger).toHaveAttribute("aria-expanded", "false");

    await user.click(burger);
    expect(burger).toHaveAttribute("aria-expanded", "true");

    await user.click(burger);
    expect(burger).toHaveAttribute("aria-expanded", "false");
  });

  it("exposes Dashboard, Events, and Users as links", () => {
    renderLayout();

    expect(screen.getAllByRole("link", { name: "Dashboard" })[0]).toHaveAttribute("href", "/admin");
    expect(screen.getAllByRole("link", { name: "Events" })[0]).toHaveAttribute(
      "href",
      "/admin/events"
    );
    expect(screen.getAllByRole("link", { name: "Users" })[0]).toHaveAttribute(
      "href",
      "/admin/users"
    );
  });

  it("shows unbuilt sections as disabled with a Soon badge, not links", () => {
    renderLayout();

    for (const label of ["Event Submissions", "Organizer Requests", "Venues", "Tags", "Settings"]) {
      expect(screen.queryAllByRole("link", { name: label })).toHaveLength(0);
      expect(screen.getAllByText(label)[0]).toBeInTheDocument();
    }
    expect(screen.getAllByText("Soon").length).toBeGreaterThan(0);
  });

  it("breadcrumb reads Users on the nested detail route", () => {
    renderLayoutAt("/admin/users/organizer-1");
    expect(
      screen.getByText("Users", { selector: ".admin-breadcrumbs__current" })
    ).toBeInTheDocument();
  });

  it("account menu shows Appearance with System checked by default", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByText("Appearance"));
    const systemOption = screen.getByRole("radio", { name: "System" });
    expect(systemOption).toBeChecked();
  });

  it("selecting Dark in the Appearance submenu calls setTheme", async () => {
    const setTheme = vi.fn();
    vi.mocked(useTheme).mockReturnValue({ theme: "system", effectiveTheme: "light", setTheme });
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByText("Appearance"));
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("account menu shows an inert Account row with no link", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });
});
