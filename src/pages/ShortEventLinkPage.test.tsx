import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import ShortEventLinkPage from "./ShortEventLinkPage";
import { fetchShortLinkMatches } from "../features/events/api/eventsRepo";

vi.mock("../features/events/api/eventsRepo", () => ({
  fetchShortLinkMatches: vi.fn(),
}));

const event1Id = "11111111-1111-1111-1111-111111111111";
const event2Id = "22222222-2222-2222-2222-222222222222";
const validCode = "1a2b3c4d";

function renderPage(path = `/e/${validCode}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/e/:code" element={<ShortEventLinkPage />} />
          <Route path="/events/:id" element={<div data-testid="event-page">Event detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(fetchShortLinkMatches).mockReset();
});

describe("ShortEventLinkPage", () => {
  it("navigates to /events/<id> when there is a unique match", async () => {
    vi.mocked(fetchShortLinkMatches).mockResolvedValue([{ id: event1Id, title: "Salsa Night" }]);

    renderPage();

    await waitFor(() => expect(screen.getByTestId("event-page")).toBeInTheDocument());
    expect(fetchShortLinkMatches).toHaveBeenCalledWith(validCode);
  });

  it("renders the 404 page when no events match the code", async () => {
    vi.mocked(fetchShortLinkMatches).mockResolvedValue([]);

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /not found/i })).toBeInTheDocument()
    );
  });

  it("renders the 404 page for an invalid code without calling the repo", () => {
    renderPage("/e/not-a-hex-code");

    expect(screen.getByRole("heading", { name: /not found/i })).toBeInTheDocument();
    expect(fetchShortLinkMatches).not.toHaveBeenCalled();
  });

  it("lists each matching night by title when several events share the code", async () => {
    vi.mocked(fetchShortLinkMatches).mockResolvedValue([
      { id: event1Id, title: "Salsa Night" },
      { id: event2Id, title: "Bachata Social" },
    ]);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/this link matches more than one event/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("link", { name: "Salsa Night" })).toHaveAttribute(
      "href",
      `/events/${event1Id}`
    );
    expect(screen.getByRole("link", { name: "Bachata Social" })).toHaveAttribute(
      "href",
      `/events/${event2Id}`
    );
  });

  it("shows an error with a Try again button when the lookup fails", async () => {
    vi.mocked(fetchShortLinkMatches).mockRejectedValue(new Error("network error"));

    renderPage();

    expect(await screen.findByText("We couldn't look up this event link.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
