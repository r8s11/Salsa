import "temporal-polyfill/global";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseEvent } from "../features/events/model/types";
import { fetchApprovedEventById, fetchApprovedEvents } from "../features/events/api/eventsRepo";
import EventDetailPage from "./EventDetailPage";

vi.mock("../features/events/api/eventsRepo", () => ({
  fetchApprovedEventById: vi.fn(),
  fetchApprovedEvents: vi.fn(),
}));

const event: DatabaseEvent = {
  id: "event-1",
  title: "Havana Nights",
  description: "A real event description.",
  event_type: "social",
  event_date: "2026-10-24T01:00:00Z",
  event_time: "21:00",
  location: "Grand Ballroom",
  address: "288 Green St",
  price_type: "paid",
  price_amount: 15,
  rsvp_link: "https://example.com/rsvp",
  image_url: null,
  submitter_name: null,
  submitter_email: null,
  submitter_id: null,
  status: "approved",
  source_type: "organizer",
  taxonomy_term_ids: ["salsa", "beginner"],
  taxonomy_terms: [
    { id: "salsa", name: "Salsa", slug: "salsa", category: "dance_style", status: "active" },
    {
      id: "beginner",
      name: "Beginner friendly",
      slug: "beginner-friendly",
      category: "event_attribute",
      status: "active",
    },
  ],
  updated_at: "2026-08-01T00:00:00Z",
  cancellation_reason: null,
  city: "boston",
  created_at: "2026-08-01T00:00:00Z",
  host: "Carlos",
  recurrence: "weekly",
  gallery: ["https://example.com/photo.jpg"],
  contact_email: "host@example.com",
  contact_instagram: "@havana",
  contact_website: "https://example.com",
  venue_id: null,
};
const withinWeek: DatabaseEvent = {
  ...event,
  id: "event-2",
  title: "Within Week",
  event_date: "2026-10-26T01:00:00Z",
};

const fallback: DatabaseEvent = {
  ...event,
  id: "event-3",
  title: "Fallback Event",
  event_date: "2026-11-05T01:00:00Z",
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/events/event-1"]}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("EventDetailPage", () => {
  beforeEach(() => {
    vi.mocked(fetchApprovedEventById).mockResolvedValue(event);
    vi.mocked(fetchApprovedEvents).mockResolvedValue([event]);
  });

  it("renders the v2 cover, action strip, and sidebar cards", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Havana Nights" })).toBeInTheDocument();

    // Cover: back pill, type badge, facts
    expect(screen.getByRole("link", { name: /the calendar/i })).toHaveAttribute(
      "href",
      "/calendar"
    );
    expect(screen.getByText("Social")).toBeInTheDocument();

    // Action strip: date chip, price, address, actions
    expect(screen.getByText("$15")).toBeInTheDocument();
    expect(screen.getAllByText("288 Green St")[0]).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rsvp/i })).toHaveAttribute(
      "href",
      "https://example.com/rsvp"
    );
    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();

    // Sidebar cards
    expect(screen.getByText("Hosted by")).toBeInTheDocument();
    expect(screen.getByText("Carlos")).toBeInTheDocument();
    expect(screen.getByText("Where")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open map/i })).toHaveAttribute(
      "href",
      expect.stringContaining("maps.google.com")
    );
    expect(screen.getByText("Share this night")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Instagram" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WhatsApp" })).toBeInTheDocument();
  });

  it("shows styles and tags as chips on the About tab", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Havana Nights" });

    expect(screen.getByRole("tab", { name: /about the night/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("Salsa")).toBeInTheDocument();
    expect(screen.getByText("Beginner friendly")).toBeInTheDocument();
    expect(screen.getByText("A real event description.")).toBeInTheDocument();
  });

  it("switches to the Photo album tab and shows gallery images", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Havana Nights" });

    await user.click(screen.getByRole("tab", { name: /photo album/i }));

    expect(screen.getByRole("img", { name: "Havana Nights gallery image 1" })).toHaveAttribute(
      "src",
      "https://example.com/photo.jpg"
    );
  });

  it("uses the existing not-found treatment when no approved event exists", async () => {
    vi.mocked(fetchApprovedEventById).mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole("heading", { name: "404" })).toBeInTheDocument();
  });

  it("renders selected same-city related event links after event detail content", async () => {
    vi.mocked(fetchApprovedEvents).mockResolvedValue([event, withinWeek, fallback]);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "More this week in Greater Boston" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /within week/i })).toHaveAttribute(
      "href",
      `/events/${withinWeek.id}`
    );
  });

  it("omits related-events strip when city query fails or selects no events", async () => {
    vi.mocked(fetchApprovedEvents).mockRejectedValue(new Error("offline"));
    renderPage();

    await screen.findByRole("heading", { name: "Havana Nights" });
    expect(screen.queryByRole("region", { name: /more/i })).not.toBeInTheDocument();
  });
});
