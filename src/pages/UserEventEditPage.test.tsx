import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DatabaseEvent } from "../features/events/model/types";
import UserEventEditPage from "./UserEventEditPage";

const mocks = vi.hoisted(() => ({
  useMySubmissions: vi.fn(),
  updateEventForUser: vi.fn(),
  deleteEventForUser: vi.fn(),
  uploadEventFlyer: vi.fn(),
  removeEventFlyer: vi.fn(),
  auth: {
    user: { id: "user-1", email: "dancer@example.com" } as { id: string; email: string } | null,
  },
}));

vi.mock("../hooks/useMySubmissions", () => ({
  useMySubmissions: mocks.useMySubmissions,
}));
vi.mock("../features/events/api/eventsRepo", () => ({
  updateEventForUser: mocks.updateEventForUser,
  deleteEventForUser: mocks.deleteEventForUser,
}));
vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({ ...mocks.auth, loading: false }),
}));

// Mock the form sub-components so the test focuses on the save wiring,
// not the field rendering (which is already covered by AdminEventForm tests).
vi.mock("../features/submit-event/components/EventDetailsFieldset", () => ({
  default: function MockEventDetailsFieldset({
    form,
    update,
  }: {
    form: Record<string, unknown>;
    update: (field: string, value: unknown) => void;
  }) {
    return (
      <fieldset>
        <label>
          Event Title *
          <input
            id="title"
            value={form.title as string}
            onChange={(e) => update("title", e.target.value)}
          />
        </label>
        <label>
          Event Type *
          <select
            value={form.event_type as string}
            onChange={(e) => update("event_type", e.target.value)}
          >
            <option value="">Select type</option>
            <option value="social">Social</option>
          </select>
        </label>
        <label>
          City *
          <select value={form.city as string} onChange={(e) => update("city", e.target.value)}>
            <option value="boston">Boston</option>
          </select>
        </label>
        <label>
          Date *
          <input
            id="event_date"
            type="date"
            value={form.event_date as string}
            onChange={(e) => update("event_date", e.target.value)}
          />
        </label>
        <label>
          Start Time
          <input
            id="event_time"
            type="time"
            value={form.event_time as string}
            onChange={(e) => update("event_time", e.target.value)}
          />
        </label>
      </fieldset>
    );
  },
}));
vi.mock("../features/submit-event/components/LocationFieldset", () => ({
  default: function MockLocationFieldset({
    form,
    update,
  }: {
    form: Record<string, unknown>;
    update: (field: string, value: unknown) => void;
  }) {
    return (
      <fieldset>
        <label>
          Venue Name
          <input
            value={form.location as string}
            onChange={(e) => update("location", e.target.value)}
          />
        </label>
      </fieldset>
    );
  },
}));
vi.mock("../features/submit-event/components/PricingFieldset", () => ({
  default: function MockPricingFieldset({
    form,
    update,
  }: {
    form: Record<string, unknown>;
    update: (field: string, value: unknown) => void;
  }) {
    return (
      <fieldset>
        <label>
          Price
          <input
            value={form.price_type as string}
            onChange={(e) => update("price_type", e.target.value)}
          />
        </label>
      </fieldset>
    );
  },
}));

vi.mock("../features/events/api/eventFlyers", () => ({
  uploadEventFlyer: mocks.uploadEventFlyer,
  removeEventFlyer: mocks.removeEventFlyer,
}));
vi.mock("../features/events/components/EventFlyerField", () => ({
  default: function MockEventFlyerField({
    onFileChange,
  }: {
    onFileChange: (file: File | null) => void;
  }) {
    return (
      <label>
        Event flyer
        <input
          type="file"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
      </label>
    );
  },
}));

const pendingEvent: DatabaseEvent = {
  id: "pending-event-id",
  title: "Pending Event",
  description: null,
  event_type: "social",
  event_date: "2026-09-01T20:00:00Z",
  event_time: "20:00",
  location: null,
  address: null,
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: null,
  submitter_name: "Test User",
  submitter_email: "test@example.com",
  submitter_id: "user-1",
  status: "pending",
  source_type: "user_submission",
  taxonomy_term_ids: [],
  taxonomy_terms: [],
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  cancellation_reason: null,
  city: "boston",
  host: null,
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  venue_id: null,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/profile/edit/pending-event-id"]}>
        <Routes>
          <Route path="/profile/edit/:eventId" element={<UserEventEditPage />} />
          <Route path="/profile" element={<div>Profile page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}


  beforeEach(() => {
    vi.clearAllMocks();
  });
describe("UserEventEditPage save flow", () => {
  it("calls updateEventForUser with the event id and transformed payload on save", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    mocks.updateEventForUser.mockResolvedValueOnce(undefined);

    renderPage();

    const titleInput = await screen.findByDisplayValue("Pending Event");
    fireEvent.change(titleInput, { target: { value: "Updated Title" } });

    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(mocks.updateEventForUser).toHaveBeenCalledTimes(1);
    });

    const [idArg, payloadArg] = mocks.updateEventForUser.mock.calls[0];
    expect(idArg).toBe("pending-event-id");
    expect(payloadArg).toMatchObject({
      title: "Updated Title",
      event_type: "social",
      city: "boston",
    });
    // The payload must NOT include admin-only / immutable fields
    expect(payloadArg).not.toHaveProperty("status");
    expect(payloadArg).not.toHaveProperty("source_type");
    expect(payloadArg).not.toHaveProperty("submitter_id");
  });

  it("uploads a selected flyer before persisting its URL", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    mocks.uploadEventFlyer.mockResolvedValueOnce({
      path: "user-1/pending-event-id/flyer.png",
      url: "https://project.supabase.co/flyer.png",
    });
    mocks.updateEventForUser.mockResolvedValueOnce(undefined);

    renderPage();

    await screen.findByDisplayValue("Pending Event");
    fireEvent.change(screen.getByLabelText("Event flyer"), {
      target: { files: [new File(["png"], "flyer.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(mocks.updateEventForUser).toHaveBeenCalledWith(
        "pending-event-id",
        expect.objectContaining({ image_url: "https://project.supabase.co/flyer.png" })
      );
    });
    expect(mocks.uploadEventFlyer).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "user-1", eventId: "pending-event-id" })
    );
  });

  it("keeps the new flyer when old-file cleanup fails after saving", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [{ ...pendingEvent, image_url: "https://project.supabase.co/old-flyer.png" }],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    mocks.uploadEventFlyer.mockResolvedValueOnce({
      path: "user-1/pending-event-id/new-flyer.png",
      url: "https://project.supabase.co/new-flyer.png",
    });
    mocks.updateEventForUser.mockResolvedValueOnce(undefined);
    mocks.removeEventFlyer.mockRejectedValueOnce(new Error("Old flyer removal failed"));

    renderPage();

    await screen.findByDisplayValue("Pending Event");
    fireEvent.change(screen.getByLabelText("Event flyer"), {
      target: { files: [new File(["png"], "new-flyer.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("Changes saved.");
    expect(mocks.removeEventFlyer).toHaveBeenCalledTimes(1);
    expect(mocks.removeEventFlyer).toHaveBeenCalledWith(
      "https://project.supabase.co/old-flyer.png"
    );
    expect(screen.queryByText(/Old flyer removal failed/i)).not.toBeInTheDocument();
  });

  it("shows an error banner when the save mutation rejects", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    mocks.updateEventForUser.mockRejectedValueOnce(new Error("Permission denied"));

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    expect(await screen.findByText(/❌ Permission denied/i)).toBeInTheDocument();
  });

  it("redirects approved events to the profile page", async () => {
    const approvedEvent: DatabaseEvent = {
      ...pendingEvent,
      id: "approved-event-id",
      status: "approved",
    };
    mocks.useMySubmissions.mockReturnValue({
      submissions: [approvedEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(await screen.findByText("Profile page")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save changes/i })).not.toBeInTheDocument();
  });
});

describe("UserEventEditPage withdraw flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls deleteEventForUser when the user confirms withdrawal", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    mocks.deleteEventForUser.mockResolvedValueOnce(undefined);
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);

    renderPage();

    await screen.findByDisplayValue("Pending Event");

    // Step 1: Click the main "Withdraw submission" button to open the dialog
    const mainWithdrawButton = screen.getByRole("button", { name: /^Withdraw submission$/ });
    fireEvent.click(mainWithdrawButton);

    // Step 2: The dialog's confirm button also says "Withdraw submission"
    // but only appears after the dialog opens — re-query now.
    const allWithdrawButtons = await screen.findAllByRole("button", {
      name: /Withdraw submission/i,
    });
    expect(allWithdrawButtons).toHaveLength(2);
    fireEvent.click(allWithdrawButtons[1]);

    await waitFor(() => {
      // deleteEventForUser(id) — useMutation calls mutationFn with (variables, context)
      expect(mocks.deleteEventForUser).toHaveBeenCalledTimes(1);
      expect(mocks.deleteEventForUser.mock.calls[0][0]).toBe("pending-event-id");
    });
  });

  it("does not call deleteEventForUser when the user cancels the confirm dialog", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    mocks.deleteEventForUser.mockResolvedValueOnce(undefined);
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);

    renderPage();

    await screen.findByDisplayValue("Pending Event");

    // Step 1: Open the withdraw dialog
    const mainWithdrawButtons = screen.getAllByRole("button", { name: /Withdraw submission/i });
    fireEvent.click(mainWithdrawButtons[0]);

    // Step 2: Click "Cancel" in the dialog (the dialog's Cancel is the 2nd Cancel button)
    const cancelButtons = screen.getAllByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButtons[1]);

    await waitFor(() => {
      expect(mocks.deleteEventForUser).not.toHaveBeenCalled();
    });
  });
});
