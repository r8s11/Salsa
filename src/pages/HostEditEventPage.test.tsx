import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import HostEditEventPage from "./HostEditEventPage";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
const { useMyOrganizers } = vi.hoisted(() => ({ useMyOrganizers: vi.fn() }));
const { useMyOrganizerEvents } = vi.hoisted(() => ({ useMyOrganizerEvents: vi.fn() }));
const { assertOrganizerAccess } = vi.hoisted(() => ({
  assertOrganizerAccess: vi.fn(),
}));
const { updateOrganizerEvent } = vi.hoisted(() => ({
  updateOrganizerEvent: vi.fn(),
}));
const { uploadEventFlyer } = vi.hoisted(() => ({
  uploadEventFlyer: vi.fn(),
}));
const { removeEventFlyer } = vi.hoisted(() => ({
  removeEventFlyer: vi.fn(),
}));
const { validateEventFlyer } = vi.hoisted(() => ({
  validateEventFlyer: vi.fn().mockReturnValue(null),
}));

vi.mock("../contexts/useAuth", () => ({ useAuth }));
vi.mock("../features/host/hooks/useMyOrganizers", () => ({ useMyOrganizers }));
vi.mock("../features/host/hooks/useMyOrganizerEvents", () => ({ useMyOrganizerEvents }));
vi.mock("../features/host/api/organizerAccessRepo", () => ({
  assertOrganizerAccess,
  updateOrganizerEvent,
  OrganizerAccessError: class OrganizerAccessError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "OrganizerAccessError";
    }
  },
}));
vi.mock("../features/events/api/eventFlyers", () => ({
  uploadEventFlyer,
  removeEventFlyer,
  validateEventFlyer,
}));

const baseEvent: DatabaseEvent = {
  id: "event-1",
  title: "Havana Fridays",
  description: "Weekly salsa social with live music.",
  event_type: "social",
  event_date: "2026-09-18T20:00:00Z",
  event_time: "20:00",
  location: "Havana Club",
  address: "123 Main St, Boston, MA",
  price_type: "paid",
  price_amount: 15,
  rsvp_link: "https://tickets.example.com/havana",
  image_url: "https://cdn.example.com/flyer.png",
  submitter_name: "Carlos",
  submitter_email: "carlos@example.com",
  submitter_id: "user-1",
  status: "approved",
  source_type: "organizer",
  taxonomy_term_ids: ["style-1"],
  taxonomy_terms: [
    { id: "style-1", name: "Salsa", slug: "salsa", category: "dance_style", status: "active" },
  ],
  updated_at: "2026-08-25T00:00:00Z",
  cancellation_reason: null,
  city: "boston",
  created_at: "2026-08-20T00:00:00Z",
  host: "Boston Salsa Collective",
  recurrence: "weekly",
  gallery: null,
  contact_email: "info@havanaclub.com",
  contact_instagram: "@havanaclub",
  contact_website: "https://havanaclub.com",
  venue_id: null,
  organizer_id: "org-1",
};

function renderEdit(eventId: string = "event-1") {
  return render(
    <MemoryRouter initialEntries={[`/host/events/${eventId}/edit`]}>
      <Routes>
        <Route path="/host/events/:eventId/edit" element={<HostEditEventPage />} />
        <Route path="/host/events/:eventId" element={<div>Host Event Detail</div>} />
        <Route path="/host/events" element={<div>Host My Events</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("HostEditEventPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: "user-1" }, role: "organizer" });
    vi.mocked(useMyOrganizers).mockReturnValue({
      data: [
        {
          organizerId: "org-1",
          organizerName: "Boston Salsa Collective",
          organizerSlug: "boston-salsa",
          organizerStatus: "active",
          memberRole: "owner",
        },
      ],
      isLoading: false,
    });
    vi.mocked(useMyOrganizerEvents).mockReturnValue({
      events: [baseEvent],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.mocked(assertOrganizerAccess).mockResolvedValue({
      organizerId: "org-1",
      organizerName: "Boston Salsa Collective",
      organizerSlug: "boston-salsa",
      organizerStatus: "active",
      memberRole: "owner",
    });
    vi.mocked(updateOrganizerEvent).mockResolvedValue(undefined);
  });

  it("renders the edit form with preloaded event values", async () => {
    renderEdit();

    expect(await screen.findByDisplayValue("Havana Fridays")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Weekly salsa social with live music.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Havana Club")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123 Main St, Boston, MA")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://tickets.example.com/havana")).toBeInTheDocument();
    expect(screen.getByDisplayValue("info@havanaclub.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("@havanaclub")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://havanaclub.com")).toBeInTheDocument();
  });

  it("shows the organizer name", async () => {
    renderEdit();

    expect(await screen.findByRole("heading", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.getByText("Organizer")).toBeInTheDocument();
  });

  it("shows event not found for unknown event", async () => {
    vi.mocked(useMyOrganizerEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderEdit("unknown-event");

    expect(await screen.findByRole("heading", { name: /Event not found/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to My Events/i })).toHaveAttribute(
      "href",
      "/host/events"
    );
  });

  it("shows access denied for unauthorized user", async () => {
    vi.mocked(assertOrganizerAccess).mockRejectedValue(new Error("No access"));

    renderEdit();

    expect(
      await screen.findByRole("heading", { name: /don't have access/i })
    ).toBeInTheDocument();
  });

  it("shows read-only state for editor role", async () => {
    vi.mocked(useMyOrganizers).mockReturnValue({
      data: [
        {
          organizerId: "org-1",
          organizerName: "Boston Salsa Collective",
          organizerSlug: "boston-salsa",
          organizerStatus: "active",
          memberRole: "editor",
        },
      ],
      isLoading: false,
    });
    vi.mocked(assertOrganizerAccess).mockResolvedValue({
      organizerId: "org-1",
      organizerName: "Boston Salsa Collective",
      organizerSlug: "boston-salsa",
      organizerStatus: "active",
      memberRole: "editor",
    });

    renderEdit();

    expect(
      await screen.findByRole("heading", { name: /don't have edit access/i })
    ).toBeInTheDocument();
  });

  it("saves changes and navigates to detail page", async () => {
    const user = userEvent.setup();
    renderEdit();

    await screen.findByRole("heading", { name: "Edit event" });

    const titleInput = screen.getByDisplayValue("Havana Fridays");
    await user.clear(titleInput);
    await user.type(titleInput, "Havana Fridays Salsa Night");

    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateOrganizerEvent).toHaveBeenCalledWith(
        "event-1",
        expect.objectContaining({ title: "Havana Fridays Salsa Night" })
      );
    });
  });

  it("does not send forbidden fields like status or organizer_id", async () => {
    const user = userEvent.setup();
    renderEdit();

    await screen.findByRole("heading", { name: "Edit event" });

    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateOrganizerEvent).toHaveBeenCalledWith(
        "event-1",
        expect.not.objectContaining({
          status: expect.anything(),
          organizer_id: expect.anything(),
          submitter_id: expect.anything(),
          source_type: expect.anything(),
          venue_id: expect.anything(),
          created_at: expect.anything(),
        })
      );
    });
  });

  it("shows error message on save failure", async () => {
    vi.mocked(updateOrganizerEvent).mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderEdit();

    await screen.findByRole("heading", { name: "Edit event" });

    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't save/i);
  });

  it("shows permission error on access denial", async () => {
    vi.mocked(updateOrganizerEvent).mockRejectedValue(
      new Error("You don't have permission to edit this event.")
    );
    const user = userEvent.setup();
    renderEdit();

    await screen.findByRole("heading", { name: "Edit event" });

    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/don't have permission/i);
  });

  it("navigates back to event detail on cancel", async () => {
    renderEdit();

    await screen.findByRole("heading", { name: "Edit event" });

    expect(screen.getByRole("link", { name: /Cancel/i })).toHaveAttribute(
      "href",
      "/host/events/event-1"
    );
  });

  it("shows loading state while event data loads", () => {
    vi.mocked(useMyOrganizerEvents).mockReturnValue({
      events: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    renderEdit();

    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("allows removing flyer", async () => {
    const user = userEvent.setup();
    renderEdit();

    await screen.findByRole("heading", { name: "Edit event" });

    const removeButton = screen.getByRole("button", { name: /Remove/i });
    await user.click(removeButton);

    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateOrganizerEvent).toHaveBeenCalledWith(
        "event-1",
        expect.objectContaining({ image_url: null })
      );
    });
  });

  it("allows replacing flyer", async () => {
    const user = userEvent.setup();
    const file = new File(["test"], "test.png", { type: "image/png" });
    vi.mocked(uploadEventFlyer).mockResolvedValue({
      path: "user-1/event-1/test.png",
      url: "https://cdn.example.com/new-flyer.png",
    });

    renderEdit();

    await screen.findByRole("heading", { name: "Edit event" });

    const input = screen.getByLabelText(/Event flyer/i);
    await user.upload(input, file);

    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateOrganizerEvent).toHaveBeenCalled();
    });
  });

  it("shows dropzone when no image_url", async () => {
    vi.mocked(useMyOrganizerEvents).mockReturnValue({
      events: [{ ...baseEvent, image_url: null }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderEdit();

    expect(await screen.findByRole("button", { name: /Choose a flyer image to upload/i })).toBeInTheDocument();
  });

  it("manager can edit event", async () => {
    vi.mocked(useMyOrganizers).mockReturnValue({
      data: [
        {
          organizerId: "org-1",
          organizerName: "Boston Salsa Collective",
          organizerSlug: "boston-salsa",
          organizerStatus: "active",
          memberRole: "manager",
        },
      ],
      isLoading: false,
    });
    vi.mocked(assertOrganizerAccess).mockResolvedValue({
      organizerId: "org-1",
      organizerName: "Boston Salsa Collective",
      organizerSlug: "boston-salsa",
      organizerStatus: "active",
      memberRole: "manager",
    });

    renderEdit();

    expect(await screen.findByRole("heading", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
  });
});
