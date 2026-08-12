import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminLayout from "./AdminLayout";

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
    </MemoryRouter>,
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
    expect(screen.getAllByRole("link", { name: "Events" })[0]).toHaveAttribute("href", "/admin/events");
    expect(screen.getAllByRole("link", { name: "Users" })[0]).toHaveAttribute("href", "/admin/users");
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
    expect(screen.getByText("Users", { selector: ".admin-breadcrumbs__current" })).toBeInTheDocument();
  });
});
