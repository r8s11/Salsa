import "temporal-polyfill/global";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseEvent } from "../features/events/model/types";
import { fetchApprovedEventById } from "../features/events/api/eventsRepo";
import EventDetailPage from "./EventDetailPage";

vi.mock("../features/events/api/eventsRepo", () => ({ fetchApprovedEventById: vi.fn() }));

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
  beforeEach(() => vi.mocked(fetchApprovedEventById).mockResolvedValue(event));

  it("renders only real approved-event details and existing action links", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Havana Nights" })).toBeInTheDocument();
    expect(screen.getByText("Salsa")).toBeInTheDocument();
    expect(screen.getByText("Beginner friendly")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open map/i })).toHaveAttribute(
      "href",
      expect.stringContaining("maps.google.com")
    );
    expect(screen.getByRole("link", { name: /rsvp/i })).toHaveAttribute(
      "href",
      "https://example.com/rsvp"
    );
    expect(screen.getByRole("img", { name: "Havana Nights gallery image 1" })).toHaveAttribute(
      "src",
      "https://example.com/photo.jpg"
    );
    expect(screen.queryByText(/attendance|capacity|registration/i)).not.toBeInTheDocument();
  });

  it("separates hero navigation from the event title and facts", async () => {
    renderPage();
    const title = await screen.findByRole("heading", { name: "Havana Nights" });
    const heroContent = title.closest(".event-page__hero-content");

    if (!heroContent) throw new Error("Expected the event hero content container.");

    expect(heroContent).not.toContainElement(screen.getByRole("link", { name: /the calendar/i }));
  });

  it("uses the existing not-found treatment when no approved event exists", async () => {
    vi.mocked(fetchApprovedEventById).mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole("heading", { name: "404" })).toBeInTheDocument();
  });
});
