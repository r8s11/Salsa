import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ComponentProps } from "react";
import AdminSidebar from "./AdminSidebar";

function renderSidebar(props: Partial<ComponentProps<typeof AdminSidebar>> = {}) {
  return render(
    <MemoryRouter>
      <AdminSidebar variant="fixed" {...props} />
    </MemoryRouter>
  );
}

describe("AdminSidebar collapse", () => {
  it("shows the Collapse control only for the fixed variant", () => {
    renderSidebar({ variant: "fixed", collapsed: false, onToggleCollapse: vi.fn() });
    expect(screen.getByRole("button", { name: /collapse/i })).toBeInTheDocument();
  });

  it("does not show a collapse control on the drawer variant", () => {
    render(
      <MemoryRouter>
        <AdminSidebar variant="drawer" />
      </MemoryRouter>
    );
    expect(screen.queryByRole("button", { name: /collapse/i })).not.toBeInTheDocument();
  });

  it("clicking the collapse control calls onToggleCollapse", async () => {
    const user = userEvent.setup();
    const onToggleCollapse = vi.fn();
    renderSidebar({ collapsed: false, onToggleCollapse });
    await user.click(screen.getByRole("button", { name: /collapse/i }));
    expect(onToggleCollapse).toHaveBeenCalledOnce();
  });

  it("when collapsed, the toggle's accessible name reflects the expand action", () => {
    renderSidebar({ collapsed: true, onToggleCollapse: vi.fn() });
    expect(screen.getByRole("button", { name: /expand/i })).toBeInTheDocument();
  });

  it("nav links carry a title attribute for collapsed-state tooltips", () => {
    renderSidebar({ collapsed: true, onToggleCollapse: vi.fn() });
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("title", "Dashboard");
  });
});

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("../../contexts/useAuth", () => ({ useAuth }));
const { useTheme } = vi.hoisted(() => ({ useTheme: vi.fn() }));
vi.mock("../../contexts/useTheme", () => ({ useTheme }));

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ user: null, signOut: vi.fn() });
  vi.mocked(useTheme).mockReturnValue({
    theme: "system",
    effectiveTheme: "light",
    setTheme: vi.fn(),
  });
});

describe("AdminSidebar drawer account block", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: "admin@salsa.test" },
      signOut: vi.fn(),
    });
    vi.mocked(useTheme).mockReturnValue({
      theme: "system",
      effectiveTheme: "light",
      setTheme: vi.fn(),
    });
  });

  it("drawer variant renders Appearance and Sign Out", () => {
    render(
      <MemoryRouter>
        <AdminSidebar variant="drawer" />
      </MemoryRouter>
    );
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("fixed variant does not render the account block", () => {
    render(
      <MemoryRouter>
        <AdminSidebar variant="fixed" collapsed={false} onToggleCollapse={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
