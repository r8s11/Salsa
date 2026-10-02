import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminLayout from "./AdminLayout";

const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
beforeAll(() => {
  // jsdom cannot scroll; visibility is exercised in the real-browser smoke.
  if (!Element.prototype.scrollIntoView) {
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  }
});
afterAll(() => {
  if (scrollIntoViewDescriptor) Object.defineProperty(Element.prototype, "scrollIntoView", scrollIntoViewDescriptor);
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});
const { useTheme } = vi.hoisted(() => ({ useTheme: vi.fn() }));
const signOut = vi.hoisted(() => vi.fn());
vi.mock("../contexts/useTheme", () => ({ useTheme }));
vi.mock("../features/admin/hooks/usePendingRequestCounts", () => ({
  usePendingOrganizerRequestCount: () => 0,
  usePendingFounderRequestCount: () => 0,
}));

vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "[EMAIL]" },
    role: "admin",
    isAdmin: true,
    isModerator: true,
    signOut,
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
          <Route path="/account" element={<p>Account settings</p>} />
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
            <Route path="*" element={<p>Workspace content</p>} />
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
    signOut.mockReset().mockResolvedValue({ error: null });
    vi.mocked(useTheme).mockReturnValue({
      theme: "system",
      effectiveTheme: "light",
      setTheme: vi.fn(),
    });
  });

  it.each(["/admin", "/host/events"])(
    "skips operator chrome and focuses main content on %s",
    async (path) => {
      const user = userEvent.setup();
      if (path.startsWith("/host")) renderHostLayoutAt(path);
      else renderLayoutAt(path);

      await user.tab();
      const skip = screen.getByRole("link", { name: "Skip to content" });
      expect(skip).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(screen.getByRole("main")).toHaveFocus();
    }
  );

  it("remembers collapse and expansion across remounts while keeping rail navigation usable", async () => {
    const storageKey = "admin-sidebar-collapsed";
    const previousPreference = window.localStorage.getItem(storageKey);
    const user = userEvent.setup();
    let view: RenderResult | undefined;

    try {
      window.localStorage.removeItem(storageKey);
      view = renderLayoutAt("/admin");
      await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
      view.unmount();

      view = renderLayoutAt("/admin");
      expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
        "aria-expanded",
        "false"
      );
      const navigation = screen.getAllByRole("navigation", { name: "Admin navigation" })[0];
      await user.click(within(navigation).getByRole("link", { name: "Users" }));
      expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Users");
      expect(within(navigation).getByRole("link", { name: "Users" })).toHaveAttribute(
        "aria-current",
        "page"
      );

      await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
      view.unmount();
      view = renderLayoutAt("/admin/users");
      expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute(
        "aria-expanded",
        "true"
      );
    } finally {
      view?.unmount();
      if (previousPreference === null) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, previousPreference);
    }
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
  it("contains focus in the open navigation drawer and restores it on Escape", async () => {
    const user = userEvent.setup();
    renderLayout();

    const opener = screen.getByRole("button", { name: "Open navigation" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    const close = within(dialog).getByRole("button", { name: "Close navigation" });
    const last = within(dialog).getByRole("button", { name: /Sign out on this device/ });

    expect(close).toHaveFocus();
    expect(document.querySelector(".admin-main")).toHaveAttribute("inert");

    last.focus();
    await user.tab();
    expect(close).toHaveFocus();

    close.focus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(opener).toHaveAttribute("aria-expanded", "false");
    expect(opener).toHaveFocus();
  });
  it("closes from the drawer backdrop and restores opener focus", async () => {
    const user = userEvent.setup();
    renderLayout();

    const opener = screen.getByRole("button", { name: "Open navigation" });
    await user.click(opener);
    await user.click(document.querySelector(".admin-drawer")!);

    expect(opener).toHaveAttribute("aria-expanded", "false");
    expect(opener).toHaveFocus();
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

  it.each([
    ["/admin/events/import", "/admin/events/import"],
    ["/admin/users/organizer-1", "/admin/users"],
    ["/admin/submissions/submission-1", "/admin/submissions"],
    ["/admin/founder-requests", "/admin/founder-requests"],
    ["/admin/founder-requests/request-1", "/admin/founder-requests"],
  ])("selects only the most specific navigation destination on %s", (path, destination) => {
    renderLayoutAt(path);

    for (const navigation of screen.getAllByRole("navigation", { name: "Admin navigation" })) {
      const current = within(navigation).getAllByRole("link", { current: "page" });
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveAttribute("href", destination);
    }
  });

  it.each([
    "/admin/events/import",
    "/admin/submissions",
    "/admin/submissions/submission-1",
    "/admin/founder-requests",
    "/admin/founder-requests/request-1",
  ])("keeps the breadcrumb aligned with the selected queue on %s", (path) => {
    renderLayoutAt(path);

    const navigation = screen.getAllByRole("navigation", { name: "Admin navigation" })[0];
    const destination = within(navigation).getByRole("link", { current: "page" });
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent(
      destination.textContent!
    );
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

  it("dismisses the account disclosure with Escape and restores its trigger focus", async () => {
    const user = userEvent.setup();
    renderLayout();
    const trigger = screen.getByRole("button", { name: "Account menu" });
    await user.click(trigger);
    await user.click(within(trigger.closest("details")!).getByText("Appearance"));
    await user.tab();
    await user.keyboard("{Escape}");
    expect(trigger.closest("details")).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("dismisses on outside interaction without stealing focus and leaves inside controls usable", async () => {
    const user = userEvent.setup();
    renderLayout();
    const trigger = screen.getByRole("button", { name: "Account menu" });
    await user.click(trigger);
    await user.click(within(trigger.closest("details")!).getByText("Appearance"));
    await user.click(within(trigger.closest("details")!).getByRole("radio", { name: "Dark" }));
    expect(trigger.closest("details")).toHaveAttribute("open");
    const outside = screen.getByRole("button", { name: /^(Collapse|Expand) sidebar$/ });
    await user.click(outside);
    expect(trigger.closest("details")).not.toHaveAttribute("open");
    expect(outside).toHaveFocus();
  });

  it("takes the Account action to the existing settings route", async () => {
    const user = userEvent.setup();
    renderLayout();
    const trigger = screen.getByRole("button", { name: "Account menu" });
    await user.click(trigger);
    await user.click(within(trigger.closest("details")!).getByRole("link", { name: "Account" }));
    expect(screen.getByText("Account settings")).toBeInTheDocument();
  });

  it.each(["returned", "thrown"])(
    "keeps a failed %s sign-out visible and allows retry",
    async (failure) => {
      if (failure === "returned") signOut.mockResolvedValueOnce({ error: new Error("network") });
      else signOut.mockRejectedValueOnce(new Error("network"));
      const user = userEvent.setup();
      renderLayout();
      await user.click(screen.getByRole("button", { name: "Account menu" }));
      const action = screen.getByRole("button", { name: "Sign out on all devices" });
      await user.click(action);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /couldn't sign you out.*try again/i
      );
      expect(action).toBeEnabled();
      expect(action.closest("details.admin-account")).toHaveAttribute("open");
      await user.click(action);
      expect(signOut).toHaveBeenCalledTimes(2);
      expect(signOut).toHaveBeenLastCalledWith("global");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Account menu" }).closest("details")
      ).not.toHaveAttribute("open");
    }
  );

  it("prevents repeated sign-out while the request is pending", async () => {
    const { promise, resolve: finish } = Promise.withResolvers<{ error: Error | null }>();
    signOut.mockReturnValueOnce(promise);
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("button", { name: "Sign out on all devices" }));
    const pending = screen.getByRole("button", { name: "Signing out…" });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(signOut).toHaveBeenCalledTimes(1);
    finish({ error: new Error("network") });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out on all devices" })).toBeEnabled();
  });
});
