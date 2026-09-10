import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import AdminLayout from "./AdminLayout";
import HostMyEventsPage from "../pages/HostMyEventsPage";
import HostEventImportPage from "../pages/HostEventImportPage";
import HostOrganizationPage from "../pages/HostOrganizationPage";
import HostEventDetailPage from "../pages/HostEventDetailPage";
import HostAttendeeListPage from "../pages/HostAttendeeListPage";

/**
 * AdminLayout owns the document's single <main> landmark. Host pages used to
 * render their own <main> inside it, giving every Host route two main
 * landmarks. These render real Host pages through the real layout so a
 * reintroduced nested <main> fails here.
 */

vi.mock("../contexts/useTheme", () => ({
  useTheme: () => ({ theme: "system", effectiveTheme: "light", setTheme: vi.fn() }),
}));
vi.mock("../features/admin/hooks/useOrganizerRequests", () => ({
  useOrganizerRequests: () => ({
    pendingCount: 0,
    pendingCountLoading: false,
    pendingCountError: null,
  }),
}));
vi.mock("../hooks/useFounderRequests", () => ({
  useFounderRequests: () => ({ pendingCount: 0 }),
}));
vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "host@example.com" },
    role: null,
    isAdmin: false,
    isModerator: false,
    isOrganizer: false,
    signOut: vi.fn(),
  }),
}));
vi.mock("../features/host/hooks/useMyOrganizers", () => ({
  useMyOrganizers: () => ({ data: [], isLoading: true }),
}));
vi.mock("../features/host/hooks/useMyOrganizerEvents", () => ({
  useMyOrganizerEvents: () => ({ events: [], isLoading: true, error: null, refetch: vi.fn() }),
}));
vi.mock("../features/host/hooks/useEventAttendees", () => ({
  useEventAttendees: () => ({ attendees: [], isLoading: true, error: null, refetch: vi.fn() }),
}));
vi.mock("../features/host/hooks/useEventCheckIns", () => ({
  useEventCheckIns: () => ({ checkIns: [], isLoading: true, error: null, refetch: vi.fn() }),
}));
vi.mock("../features/host/hooks/useEventAttendanceSummaries", () => ({
  useEventAttendanceSummaries: () => ({ summaries: {}, isLoading: false }),
}));
vi.mock("../hooks/useMySubmissions", () => ({
  useMySubmissions: () => ({
    submissions: [],
    approvedEvents: [],
    isLoading: true,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock("../hooks/useHostEventImport", () => ({
  useHostEventImport: () => ({
    stage: "idle",
    fileName: null,
    fileSize: null,
    fileErrors: [],
    rows: [],
    counts: { total: 0, valid: 0, warning: 0, invalid: 0 },
    includedDuplicates: new Set<number>(),
    toggleIncludeDuplicate: vi.fn(),
    importableCount: 0,
    excludedDuplicateCount: 0,
    importResult: null,
    importError: null,
    handleFile: vi.fn(),
    runImport: vi.fn(),
    reset: vi.fn(),
    taxonomyLoading: false,
  }),
}));

vi.mock("../features/host/api/organizerAccessRepo", () => ({
  // Never settles: the organization page must stay in its loading root.
  fetchOrganizerProfile: vi.fn(() => Promise.withResolvers<never>().promise),
  updateOrganizerProfile: vi.fn(),
  deleteOrganizerEvent: vi.fn(),
  OrganizerAccessError: class OrganizerAccessError extends Error {},
}));

function renderHostRoute(path: string, routePath: string, page: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/host" element={<AdminLayout />}>
            <Route path={routePath} element={page} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Host pages inside AdminLayout", () => {
  it.each([
    ["/host/events", "events", <HostMyEventsPage />],
    ["/host/events/import", "events/import", <HostEventImportPage />],
    ["/host/organization", "organization", <HostOrganizationPage />],
    ["/host/events/abc-123", "events/:eventId", <HostEventDetailPage />],
    ["/host/events/abc-123/attendees", "events/:eventId/attendees", <HostAttendeeListPage />],
  ])("exposes exactly one main landmark on %s", (path, routePath, page) => {
    renderHostRoute(path, routePath, page);

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveClass("admin-main");
  });
});
