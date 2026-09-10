import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminLayout from "./AdminLayout";
const { useTheme } = vi.hoisted(() => ({ useTheme: vi.fn() }));
const useOrganizerRequests = vi.hoisted(() => vi.fn());
vi.mock("../contexts/useTheme", () => ({ useTheme }));
vi.mock("../features/admin/hooks/useOrganizerRequests", () => ({ useOrganizerRequests }));

vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "[EMAIL]" },
    role: "admin",
    isAdmin: true,
    isModerator: true,
    signOut: vi.fn(),
  }),
}));

function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderLayout() {
  const queryClient = makeTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<p>Dashboard content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderLayoutAt(path: string) {
  const queryClient = makeTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<p>Dashboard content</p>} />
            <Route path="users/:id" element={<p>Detail content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderHostLayoutAt(path: string) {
  const queryClient = makeTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/host" element={<AdminLayout />}>
            <Route index element={<p>Host dashboard</p>} />
            <Route path="events" element={<p>Host events</p>} />
            <Route path="events/new" element={<p>Host create event</p>} />
            <Route path="events/import" element={<p>Host import</p>} />
            <Route path="events/:eventId" element={<p>Host event detail</p>} />
            <Route path="events/:eventId/edit" element={<p>Host edit event</p>} />
            <Route path="events/:eventId/attendees" element={<p>Host attendees</p>} />
            <Route path="events/:eventId/check-in" element={<p>Host check-in</p>} />
            <Route path="organization" element={<p>Host organization</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.mocked(useTheme).mockReturnValue({
      theme: "system",
      effectiveTheme: "light",
      setTheme: vi.fn(),
    });
    vi.mocked(useOrganizerRequests).mockReturnValue({
      pendingCount: 0,
      pendingCountLoading: false,
      pendingCountError: null,
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

  it("provides a close control inside the mobile navigation drawer", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    await user.click(screen.getByRole("button", { name: "Close navigation" }));

    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("exposes Dashboard, Events, Users, Organizer Requests, and Venues as links", () => {
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
    expect(screen.getAllByRole("link", { name: "Organizer Requests" })[0]).toHaveAttribute(
      "href",
      "/admin/organizer-requests"
    );
    expect(screen.getAllByRole("link", { name: "Venues" })[0]).toHaveAttribute(
      "href",
      "/admin/venues"
    );
  });

  it("links built taxonomy and Settings", () => {
    renderLayout();
    expect(screen.getAllByRole("link", { name: "Event Submissions" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Tags" })[0]).toHaveAttribute("href", "/admin/tags");
    expect(screen.getAllByRole("link", { name: "Settings" })[0]).toHaveAttribute(
      "href",
      "/admin/settings"
    );
  });

  it("breadcrumb reads Users on the nested detail route", () => {
    renderLayoutAt("/admin/users/organizer-1");
    expect(
      screen.getByText("Users", { selector: ".admin-breadcrumbs__current" })
    ).toBeInTheDocument();
  });

  it("breadcrumb on dashboard route reads 'Admin · Dashboard'", () => {
    renderLayout();
    expect(
      screen.getByText("Admin · Dashboard", { selector: ".admin-breadcrumbs__crumb" })
    ).toBeInTheDocument();
  });

  it.each([
    ["/host", "Host · Dashboard"],
    ["/host/events", "Host · My Events"],
    ["/host/events/new", "Host · New Event"],
    ["/host/events/import", "Host · Import Events"],
    ["/host/events/abc-123", "Host · Event Details"],
    ["/host/events/abc-123/edit", "Host · Edit Event"],
    ["/host/events/abc-123/attendees", "Host · Attendees"],
    ["/host/events/abc-123/check-in", "Host · Check-in"],
    ["/host/organization", "Host · Organization"],
  ])("labels the Host location %s as %s", (path, expected) => {
    renderHostLayoutAt(path);

    expect(
      screen.getByText(expected, { selector: ".admin-breadcrumbs__crumb" })
    ).toBeInTheDocument();
  });

  it("names the navigation landmark for the Host workspace", () => {
    renderHostLayoutAt("/host/events");

    expect(screen.getAllByRole("navigation", { name: "Host navigation" })).toHaveLength(2);
    expect(screen.queryByRole("navigation", { name: "Admin navigation" })).not.toBeInTheDocument();
  });

  it("keeps the Admin navigation landmark on Admin routes", () => {
    renderLayout();

    expect(screen.getAllByRole("navigation", { name: "Admin navigation" })).toHaveLength(2);
  });

  it("account menu shows Appearance with System checked by default", async () => {
    const user = userEvent.setup();
    renderLayout();
    const topbar = within(document.querySelector(".admin-topbar") as HTMLElement);
    await user.click(topbar.getByRole("button", { name: "Account menu" }));
    await user.click(topbar.getByText("Appearance"));
    const systemOption = topbar.getByRole("radio", { name: "System" });
    expect(systemOption).toBeChecked();
  });

  it("selecting Dark in the Appearance submenu calls setTheme", async () => {
    const setTheme = vi.fn();
    vi.mocked(useTheme).mockReturnValue({ theme: "system", effectiveTheme: "light", setTheme });
    const user = userEvent.setup();
    renderLayout();
    const topbar = within(document.querySelector(".admin-topbar") as HTMLElement);
    await user.click(topbar.getByRole("button", { name: "Account menu" }));
    await user.click(topbar.getByText("Appearance"));
    await user.click(topbar.getByRole("radio", { name: "Dark" }));
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
