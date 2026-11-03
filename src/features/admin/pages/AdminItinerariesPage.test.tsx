import "temporal-polyfill/global";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { AdminItineraryRow } from "../../itineraries/api/itinerariesRepo";
import AdminItinerariesPage from "./AdminItinerariesPage";

const { useAdminItineraries } = vi.hoisted(() => ({ useAdminItineraries: vi.fn() }));
const repo = vi.hoisted(() => ({
  setItineraryStatus: vi.fn(),
  findLiveItinerary: vi.fn(),
  saveItinerary: vi.fn(),
  fetchItineraryDraft: vi.fn(),
}));
const events = vi.hoisted(() => ({
  fetchApprovedEventsBetween: vi.fn(),
  fetchApprovedEventsByIds: vi.fn(),
}));

vi.mock("../../itineraries/hooks/useItineraryQueries", () => ({
  ADMIN_ITINERARIES_KEY: ["admin", "itineraries"],
  useAdminItineraries,
}));
vi.mock("../../itineraries/api/itinerariesRepo", async (importOriginal) => ({
  ...(await importOriginal()),
  ...repo,
}));
vi.mock("../../events/api/eventsRepo", () => events);
vi.mock("../../metros/hooks/useMetros", () => ({
  useMetroName: () => (slug: string) => (slug === "new-york-city" ? "New York City" : "Boston"),
}));

function row(overrides: Partial<AdminItineraryRow>): AdminItineraryRow {
  return {
    id: "it-1",
    city: "boston",
    weekStart: "2026-11-09",
    timeZone: "America/New_York",
    title: "Boston week",
    description: null,
    recommendations: null,
    unfeaturedDays: [],
    status: "draft",
    coverImageUrl: null,
    coverGeneratedAt: null,
    publishedAt: null,
    updatedAt: "2026-11-02T15:00:00.000Z",
    eventCount: 3,
    ...overrides,
  };
}

const rows = [
  row({ id: "d1", title: "Draft week" }),
  row({ id: "p1", title: "Published week", status: "published", weekStart: "2026-11-02" }),
  row({ id: "a1", title: "Archived week", status: "archived", weekStart: "2026-10-26" }),
];

function LocationProbe() {
  const location = useLocation();
  return (
    <p data-testid="location">
      {location.pathname}
      {location.state ? JSON.stringify(location.state) : ""}
    </p>
  );
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin/itineraries"]}>
        <Routes>
          <Route path="/admin/itineraries" element={<AdminItinerariesPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function openActions(title: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: `Actions for ${title}` }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  useAdminItineraries.mockReturnValue({ itineraries: rows, loading: false, error: null, refetch: vi.fn() });
});

describe("AdminItinerariesPage", () => {
  it("lists only drafts on the Drafts tab", () => {
    renderPage();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Draft week")).toBeInTheDocument();
    expect(within(table).queryByText("Published week")).not.toBeInTheDocument();
    expect(within(table).queryByText("Archived week")).not.toBeInTheDocument();
    expect(within(table).getByText("Nov 9–15, 2026")).toBeInTheDocument();
    expect(within(table).getByText("Boston")).toBeInTheDocument();
  });

  it("navigates to the existing live week and never saves a copy", async () => {
    repo.findLiveItinerary.mockResolvedValue("existing-id");
    renderPage();

    const user = await openActions("Draft week");
    await user.click(screen.getByRole("menuitem", { name: "Create next week" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/itineraries/existing-id")
    );
    expect(repo.findLiveItinerary).toHaveBeenCalledWith("boston", "2026-11-16");
    expect(repo.saveItinerary).not.toHaveBeenCalled();
  });

  it("copies the matched week and reports dropped events", async () => {
    repo.findLiveItinerary.mockResolvedValue(null);
    repo.fetchItineraryDraft.mockResolvedValue({
      itinerary: rows[0],
      draft: {
        id: "d1",
        city: "boston",
        weekStart: "2026-11-09",
        timeZone: "America/New_York",
        title: "Draft week",
        description: null,
        recommendations: null,
        unfeaturedDays: [],
        items: [{ eventId: "gone", role: "featured", position: 0, note: null }],
      },
    });
    events.fetchApprovedEventsBetween.mockResolvedValue([]);
    events.fetchApprovedEventsByIds.mockResolvedValue([]);
    repo.saveItinerary.mockResolvedValue("new-id");
    renderPage();

    const user = await openActions("Draft week");
    await user.click(screen.getByRole("menuitem", { name: "Create next week" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/itineraries/new-id")
    );
    expect(repo.saveItinerary).toHaveBeenCalledWith(
      expect.objectContaining({ id: null, weekStart: "2026-11-16", items: [] })
    );
    expect(screen.getByTestId("location")).toHaveTextContent('"dropped"');
  });

  it("asks for confirmation before archiving", async () => {
    repo.setItineraryStatus.mockResolvedValue(null);
    renderPage();

    const user = await openActions("Draft week");
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));

    expect(repo.setItineraryStatus).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(repo.setItineraryStatus).toHaveBeenCalledWith("d1", "archived"));
  });
});
