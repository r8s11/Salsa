import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import AdminSidebar from "./AdminSidebar";
import {
  usePendingFounderRequestCount,
  usePendingOrganizerRequestCount,
} from "../../features/admin/hooks/usePendingRequestCounts";
import type {
  OrganizerMemberRole,
  OrganizerMembership,
} from "../../features/host/api/organizerAccessRepo";

function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderSidebar(props: Partial<ComponentProps<typeof AdminSidebar>> = {}) {
  const queryClient = makeTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminSidebar variant="fixed" {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("../../contexts/useAuth", () => ({ useAuth }));
const { useTheme } = vi.hoisted(() => ({ useTheme: vi.fn() }));
vi.mock("../../contexts/useTheme", () => ({ useTheme }));
const { useMyOrganizers } = vi.hoisted(() => ({ useMyOrganizers: vi.fn() }));
vi.mock("../../features/host/hooks/useMyOrganizers", () => ({ useMyOrganizers }));
vi.mock("../../features/admin/hooks/usePendingRequestCounts", () => ({
  usePendingOrganizerRequestCount: vi.fn(() => 0),
  usePendingFounderRequestCount: vi.fn(() => 0),
}));

function mockPending(organizer: number, founder: number) {
  vi.mocked(usePendingOrganizerRequestCount).mockReturnValue(organizer);
  vi.mocked(usePendingFounderRequestCount).mockReturnValue(founder);
}

beforeEach(() => {
  mockPending(0, 0);
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    role: "admin",
    isAdmin: true,
    isModerator: false,
    signOut: vi.fn(),
  });
  vi.mocked(useTheme).mockReturnValue({
    theme: "system",
    effectiveTheme: "light",
    setTheme: vi.fn(),
  });
  vi.mocked(useMyOrganizers).mockReturnValue({ data: [], isLoading: false });
});

function membership(
  memberRole: OrganizerMemberRole,
  organizerStatus = "active"
): OrganizerMembership {
  return {
    organizerId: `org-${memberRole}`,
    organizerName: "Boston Salsa Collective",
    organizerSlug: "boston-salsa",
    organizerStatus,
    memberRole,
    description: null,
    logoUrl: null,
    website: null,
    instagram: null,
    organizerType: null,
    primaryCity: null,
  };
}

/** Signed-in host whose only Host claim is an organizer_members row. */
function mockMembershipOnlyHost(memberRole: OrganizerMemberRole, organizerStatus = "active") {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: "user-1", email: "host@example.com" },
    role: null,
    isAdmin: false,
    isModerator: false,
    isOrganizer: false,
    signOut: vi.fn(),
  });
  vi.mocked(useMyOrganizers).mockReturnValue({
    data: [membership(memberRole, organizerStatus)],
    isLoading: false,
  });
}

/** Legacy account carrying app_metadata.role === "organizer". */
function mockOrganizerRoleHost(memberships: OrganizerMembership[] = []) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: "user-1", email: "host@example.com" },
    role: "organizer",
    isAdmin: false,
    isModerator: false,
    isOrganizer: true,
    signOut: vi.fn(),
  });
  vi.mocked(useMyOrganizers).mockReturnValue({ data: memberships, isLoading: false });
}

function hostNavLabels(): string[] {
  return screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("title"))
    .filter((title): title is string => title !== null);
}

describe("AdminSidebar collapse", () => {
  it("shows the Collapse control only for the fixed variant", () => {
    renderSidebar({ variant: "fixed", collapsed: false, onToggleCollapse: vi.fn() });
    expect(screen.getByRole("button", { name: /collapse/i })).toBeInTheDocument();
  });

  it("does not show a collapse control on the drawer variant", () => {
    const queryClient = makeTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminSidebar variant="drawer" />
        </MemoryRouter>
      </QueryClientProvider>
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

describe("AdminSidebar public brand navigation", () => {
  it("links the Salsa Segura brand to the public homepage", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "Salsa Segura home" })).toHaveAttribute("href", "/");
  });
});

describe("AdminSidebar drawer account block", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: "[EMAIL]" },
      role: "admin",
      isAdmin: true,
      isModerator: false,
      signOut: vi.fn(),
    });
    vi.mocked(useTheme).mockReturnValue({
      theme: "system",
      effectiveTheme: "light",
      setTheme: vi.fn(),
    });
  });

  it("fixed variant does not render the account block", () => {
    const queryClient = makeTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminSidebar variant="fixed" collapsed={false} onToggleCollapse={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.queryByRole("button", { name: /^Sign out/ })).not.toBeInTheDocument();
  });
});

describe("AdminSidebar settings navigation", () => {
  it("renders Settings as an admin-only link", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: "[EMAIL]" },
      role: "admin",
      isAdmin: true,
      isModerator: true,
      signOut: vi.fn(),
    });

    renderSidebar();

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/admin/settings"
    );
  });

  it("does not render Settings for moderators", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: "[EMAIL]" },
      role: "moderator",
      isAdmin: false,
      isModerator: true,
      signOut: vi.fn(),
    });

    renderSidebar();

    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });
});

function renderSidebarAt(path: string) {
  const queryClient = makeTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AdminSidebar variant="fixed" mode="host" />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AdminSidebar Host navigation", () => {
  it("points the legacy organizer role at the guarded Host routes", () => {
    mockOrganizerRoleHost([membership("owner")]);
    renderSidebar({ mode: "host" });

    expect(screen.getByRole("link", { name: "Host Dashboard" })).toHaveAttribute("href", "/host");
    expect(screen.getByRole("link", { name: "My Events" })).toHaveAttribute("href", "/host/events");
    expect(screen.getByRole("link", { name: "New Event" })).toHaveAttribute(
      "href",
      "/host/events/new"
    );
    expect(screen.getByRole("link", { name: "Import" })).toHaveAttribute(
      "href",
      "/host/events/import"
    );
    expect(screen.getByRole("link", { name: "Organization" })).toHaveAttribute(
      "href",
      "/host/organization"
    );
    // Admin-only platform surfaces stay behind RequireReviewer.
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Bulk Upload")).not.toBeInTheDocument();
    expect(screen.queryByText("Events")).not.toBeInTheDocument();
  });

  it("gives a membership-only owner the full Host navigation — no coarse role required", () => {
    mockMembershipOnlyHost("owner");
    renderSidebar({ mode: "host" });

    expect(hostNavLabels()).toEqual([
      "Host Dashboard",
      "My Events",
      "New Event",
      "Import",
      "Organization",
    ]);
  });

  it("gives a membership-only manager create and import navigation", () => {
    mockMembershipOnlyHost("manager");
    renderSidebar({ mode: "host" });

    expect(hostNavLabels()).toEqual([
      "Host Dashboard",
      "My Events",
      "New Event",
      "Import",
      "Organization",
    ]);
  });

  it("withholds create and import from an editor membership", () => {
    mockMembershipOnlyHost("editor");
    renderSidebar({ mode: "host" });

    expect(hostNavLabels()).toEqual(["Host Dashboard", "My Events", "Organization"]);
  });

  it("withholds create and import when the organizer itself is not active", () => {
    mockMembershipOnlyHost("owner", "suspended");
    renderSidebar({ mode: "host" });

    expect(hostNavLabels()).toEqual(["Host Dashboard", "My Events", "Organization"]);
  });

  it("offers no create or import navigation to a role-only organizer with no membership", () => {
    // Documents today's behavior: HostCreateEventPage and HostEventImportPage
    // both need a concrete active owner/manager membership to pick an
    // organizer_id, so the shell must not advertise those destinations.
    mockOrganizerRoleHost();
    renderSidebar({ mode: "host" });

    expect(hostNavLabels()).toEqual(["Host Dashboard", "My Events", "Organization"]);
  });

  it("offers no Host navigation without a role or a membership", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "visitor@example.com" },
      role: null,
      isAdmin: false,
      isModerator: false,
      isOrganizer: false,
      signOut: vi.fn(),
    });
    renderSidebar({ mode: "host" });

    expect(screen.queryByRole("link", { name: "Host Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Events" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organization" })).not.toBeInTheDocument();
  });

  it("keeps Admin navigation for an admin who also holds an organizer membership", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "admin-1", email: "admin@example.com" },
      role: "admin",
      isAdmin: true,
      isModerator: true,
      isOrganizer: false,
      signOut: vi.fn(),
    });
    vi.mocked(useMyOrganizers).mockReturnValue({
      data: [membership("owner")],
      isLoading: false,
    });
    renderSidebar();

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Host Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New Event" })).not.toBeInTheDocument();
  });
});

describe("AdminSidebar Host active states", () => {
  const cases: [string, string][] = [
    ["/host", "Host Dashboard"],
    ["/host/events", "My Events"],
    ["/host/events/new", "New Event"],
    ["/host/events/import", "Import"],
    ["/host/events/abc-123", "My Events"],
    ["/host/events/abc-123/edit", "My Events"],
    ["/host/events/abc-123/attendees", "My Events"],
    ["/host/events/abc-123/check-in", "My Events"],
    ["/host/organization", "Organization"],
  ];

  it.each(cases)("marks exactly one nav entry current on %s", (path, expectedLabel) => {
    mockMembershipOnlyHost("owner");
    renderSidebarAt(path);

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");

    expect(current.map((link) => link.getAttribute("title"))).toEqual([expectedLabel]);
    expect(current[0]).toHaveClass("admin-nav__link--active");
  });
});

describe("AdminSidebar navigation landmark", () => {
  it("names the Host navigation landmark on Host routes", () => {
    mockMembershipOnlyHost("owner");
    renderSidebar({ mode: "host" });

    expect(screen.getByRole("navigation", { name: "Host navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Admin navigation" })).not.toBeInTheDocument();
  });

  it("keeps the Admin navigation landmark name by default", () => {
    renderSidebar();

    expect(screen.getByRole("navigation", { name: "Admin navigation" })).toBeInTheDocument();
  });
});

describe("AdminSidebar pending counts", () => {
  it("names each queue's own pending count in the link's accessible name", () => {
    mockPending(12, 3);
    renderSidebar();

    expect(
      screen.getByRole("link", { name: /Organizer Requests\s*\(12 pending\)/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Founder Requests\s*\(3 pending\)/ })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/pending organizer requests/i)).not.toBeInTheDocument();
  });

  it("omits the count when nothing is pending", () => {
    mockPending(0, 0);
    renderSidebar();

    expect(screen.getByRole("link", { name: "Founder Requests" })).toBeInTheDocument();
    expect(screen.queryByText(/pending/)).not.toBeInTheDocument();
  });
});

describe("AdminSidebar collapse toggle semantics", () => {
  it("exposes expanded state and the controlled sidebar", () => {
    const { rerender } = renderSidebar({ collapsed: false, onToggleCollapse: vi.fn() });
    const nav = screen.getByRole("navigation", { name: "Admin navigation" });
    const toggle = screen.getByRole("button", { name: /collapse sidebar/i });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-controls", nav.id);

    rerender(
      <QueryClientProvider client={makeTestQueryClient()}>
        <MemoryRouter>
          <AdminSidebar variant="fixed" collapsed onToggleCollapse={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByRole("button", { name: /expand sidebar/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
});

describe("AdminSidebar drawer sign out", () => {
  function mockSignOut(signOut: () => Promise<{ error: Error | null }>) {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: "[EMAIL]" },
      role: "admin",
      isAdmin: true,
      isModerator: false,
      signOut,
    });
  }

  it("signs out of this device only", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mockSignOut(signOut);
    renderSidebar({ variant: "drawer" });

    await userEvent.setup().click(screen.getByRole("button", { name: /Sign out on this device/ }));

    expect(signOut).toHaveBeenCalledExactlyOnceWith("local");
  });

  it("shows an in-place alert and re-enables the button when sign out fails", async () => {
    mockSignOut(vi.fn().mockResolvedValue({ error: new Error("network") }));
    renderSidebar({ variant: "drawer" });

    await userEvent.setup().click(screen.getByRole("button", { name: /Sign out on this device/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't sign you out/i);
    expect(screen.getByRole("button", { name: /Sign out on this device/ })).toBeEnabled();
  });

  it("treats a thrown sign out the same as a returned error", async () => {
    mockSignOut(vi.fn().mockRejectedValue(new Error("boom")));
    renderSidebar({ variant: "drawer" });

    await userEvent.setup().click(screen.getByRole("button", { name: /Sign out on this device/ }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("AdminSidebar drawer View site link", () => {
  it("navigates in-app and closes the drawer", async () => {
    const onNavigate = vi.fn();
    renderSidebar({ variant: "drawer", onNavigate });

    const link = screen.getByRole("link", { name: "View site" });
    expect(link).toHaveAttribute("href", "/");
    await userEvent.setup().click(link);

    expect(onNavigate).toHaveBeenCalledOnce();
  });
});

describe("AdminSidebar navigation groups", () => {
  function mockRole(role: "admin" | "moderator") {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: "[EMAIL]" },
      role,
      isAdmin: role === "admin",
      isModerator: true,
      signOut: vi.fn(),
    });
  }

  it("groups admin destinations as Desk, Management, Platform with Settings under Platform", () => {
    mockRole("admin");
    renderSidebar();

    const labels = ["Desk", "Management", "Platform"].map((name) => screen.getByText(name));
    labels.forEach((label, index) => {
      if (index > 0) {
        expect(
          labels[index - 1].compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
      }
    });
    expect(screen.queryByText("System")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tags" })).toBeInTheDocument();
  });

  it("shows a moderator only the Desk links, with no group label and no Tags", () => {
    mockRole("moderator");
    renderSidebar();

    const titles = screen.getAllByRole("link").map((link) => link.getAttribute("title"));
    expect(titles).toEqual([
      null,
      "Dashboard",
      "Event Submissions",
      "Organizer Requests",
      "Founder Requests",
    ]);
    expect(screen.queryByText("Desk")).not.toBeInTheDocument();
  });

  it("does not label the Host navigation's single group", () => {
    mockMembershipOnlyHost("owner");
    renderSidebar({ mode: "host" });

    expect(screen.queryByText("Host")).not.toBeInTheDocument();
    expect(screen.queryByText("Management")).not.toBeInTheDocument();
  });
});

describe("AdminSidebar pending count fetching", () => {
  it.each(["admin", "moderator"] as const)("enables both count queries for a %s", (role) => {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: "[EMAIL]" },
      role,
      isAdmin: role === "admin",
      isModerator: true,
      signOut: vi.fn(),
    });
    renderSidebar();

    expect(usePendingOrganizerRequestCount).toHaveBeenLastCalledWith(true);
    expect(usePendingFounderRequestCount).toHaveBeenLastCalledWith(true);
  });

  it("disables both count queries for a Host user, who sees no review queue", () => {
    mockMembershipOnlyHost("owner");
    renderSidebar({ mode: "host" });

    expect(usePendingOrganizerRequestCount).toHaveBeenLastCalledWith(false);
    expect(usePendingFounderRequestCount).toHaveBeenLastCalledWith(false);
  });
});
