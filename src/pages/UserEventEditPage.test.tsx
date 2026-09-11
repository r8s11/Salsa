import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DatabaseEvent } from "../features/events/model/types";
import UserEventEditPage from "./UserEventEditPage";

const mocks = vi.hoisted(() => ({
  useMySubmissions: vi.fn(),
  updateEventForUser: vi.fn(),
  deleteEventForUser: vi.fn(),
  updateOwnEventSubmission: vi.fn(),
  withdrawOwnEventSubmission: vi.fn(),
  uploadEventFlyer: vi.fn(),
  removeEventFlyer: vi.fn(),
  auth: {
    user: { id: "user-1", email: "dancer@example.com" } as { id: string; email: string } | null,
    isOrganizer: false,
  },
}));

vi.mock("../hooks/useMySubmissions", () => ({
  useMySubmissions: mocks.useMySubmissions,
}));
vi.mock("../features/events/api/eventsRepo", () => ({
  updateEventForUser: mocks.updateEventForUser,
  deleteEventForUser: mocks.deleteEventForUser,
}));
vi.mock("../features/admin/api/submissionsRepo", () => ({
  updateOwnEventSubmission: mocks.updateOwnEventSubmission,
  withdrawOwnEventSubmission: mocks.withdrawOwnEventSubmission,
}));
vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({ ...mocks.auth, loading: false }),
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
        <input type="file" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
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

const pendingSubmissionEvent: DatabaseEvent = {
  ...pendingEvent,
  id: "submission-id",
  submission_id: "submission-id",
  image_url: null,
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
  vi.resetAllMocks();
  mocks.auth.isOrganizer = false;
});
describe("UserEventEditPage save flow", () => {
  it("calls updateEventForUser with event id and transformed payload on legacy event save", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    mocks.updateEventForUser.mockResolvedValueOnce(undefined);

    renderPage();

    fireEvent.change(await screen.findByDisplayValue("Pending Event"), {
      target: { value: "Updated Title" },
    });
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
    expect(payloadArg).not.toHaveProperty("status");
    expect(payloadArg).not.toHaveProperty("source_type");
    expect(payloadArg).not.toHaveProperty("submitter_id");
  });

  it("saves a projected moderation submission through edited_data, not canonical events", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingSubmissionEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    mocks.updateOwnEventSubmission.mockResolvedValueOnce(undefined);

    renderPageFor("submission-id");

    fireEvent.change(await screen.findByDisplayValue("Pending Event"), {
      target: { value: "Revised submission title" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(mocks.updateOwnEventSubmission).toHaveBeenCalledWith(
        "submission-id",
        expect.objectContaining({ title: "Revised submission title" })
      );
    });
    expect(mocks.updateEventForUser).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Event flyer")).not.toBeInTheDocument();
  });

  it("uses the reference authoring header and review guidance", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.getByText(/changes stay in review/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Artwork" })).toBeInTheDocument();
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
    // Focus starts on Cancel, never on the destructive control.
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(mocks.deleteEventForUser).not.toHaveBeenCalled();

    fireEvent.click(allWithdrawButtons[1]);

    await waitFor(() => {
      // deleteEventForUser(id) — useMutation calls mutationFn with (variables, context)
      expect(mocks.deleteEventForUser).toHaveBeenCalledTimes(1);
      expect(mocks.deleteEventForUser.mock.calls[0][0]).toBe("pending-event-id");
    });
  });

  it("does not call deleteEventForUser when the user cancels the dialog", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    mocks.deleteEventForUser.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    renderPage();

    await screen.findByDisplayValue("Pending Event");

    // Step 1: Open the withdraw dialog
    const mainWithdrawButtons = screen.getAllByRole("button", { name: /Withdraw submission/i });
    await user.click(mainWithdrawButtons[0]);

    // Step 2: Click "Cancel" in the dialog (the dialog's Cancel is the 2nd Cancel button)
    const cancelButtons = screen.getAllByRole("button", { name: /Cancel/i });
    await user.click(cancelButtons[1]);

    await waitFor(() => {
      expect(mocks.deleteEventForUser).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(mainWithdrawButtons[0]).toHaveFocus();
  });

  it("closes on Escape while idle but not while withdrawal is pending", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    let resolveDelete: (() => void) | undefined;
    mocks.deleteEventForUser.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        })
    );

    renderPage();
    await screen.findByDisplayValue("Pending Event");
    fireEvent.click(screen.getByRole("button", { name: /^Withdraw submission$/ }));
    await screen.findByRole("dialog");
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.deleteEventForUser).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^Withdraw submission$/ }));
    const allButtons = await screen.findAllByRole("button", { name: /Withdraw submission/i });
    fireEvent.click(allButtons[1]);
    await waitFor(() => expect(mocks.deleteEventForUser).toHaveBeenCalledTimes(1));

    // Busy: Escape must not close the dialog.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    resolveDelete?.();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("withdraws a projected moderation submission through status=withdrawn", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingSubmissionEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    mocks.withdrawOwnEventSubmission.mockResolvedValueOnce(undefined);

    renderPageFor("submission-id");

    await screen.findByDisplayValue("Pending Event");
    fireEvent.click(screen.getByRole("button", { name: /^Withdraw submission$/ }));
    const controls = await screen.findAllByRole("button", { name: /Withdraw submission/i });
    fireEvent.click(controls[1]);

    await waitFor(() => {
      expect(mocks.withdrawOwnEventSubmission).toHaveBeenCalledWith("submission-id");
    });
    expect(mocks.deleteEventForUser).not.toHaveBeenCalled();
  });

});

const rejectedEvent: DatabaseEvent = {
  ...pendingEvent,
  id: "rejected-event-id",
  status: "rejected",
};
const approvedEvent: DatabaseEvent = {
  ...pendingEvent,
  id: "approved-event-id",
  status: "approved",
};

function renderPageFor(eventId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/profile/edit/${eventId}`]}>
        <Routes>
          <Route path="/profile/edit/:eventId" element={<UserEventEditPage />} />
          <Route path="/profile" element={<div>Profile page</div>} />
          <Route path="/host/events" element={<div>Host My Events page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("UserEventEditPage organizer context", () => {
  it("shows the Host eyebrow and pending-review heading for an organizer editing a pending event", async () => {
    mocks.auth.isOrganizer = true;
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });

    renderPageFor("pending-event-id");

    expect(await screen.findByText("Host · Edit Event")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Edit event submission" })).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows revise copy and the Rejected status for an organizer editing a rejected event", async () => {
    mocks.auth.isOrganizer = true;
    mocks.useMySubmissions.mockReturnValue({
      submissions: [rejectedEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });

    renderPageFor("rejected-event-id");

    expect(
      await screen.findByRole("heading", { name: "Revise event submission" })
    ).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("keeps the existing community heading for a non-organizer", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });

    renderPageFor("pending-event-id");

    expect(await screen.findByRole("heading", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.queryByText("Host · Edit Event")).not.toBeInTheDocument();
  });

  it("returns an organizer to My Events on Cancel", async () => {
    mocks.auth.isOrganizer = true;
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });

    renderPageFor("pending-event-id");

    await screen.findByDisplayValue("Pending Event");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Host My Events page")).toBeInTheDocument();
  });

  it("keeps the Profile destination for a non-organizer on Cancel", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });

    renderPageFor("pending-event-id");

    await screen.findByDisplayValue("Pending Event");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Profile page")).toBeInTheDocument();
  });

  it("redirects an organizer viewing a stale approved event to My Events", async () => {
    mocks.auth.isOrganizer = true;
    mocks.useMySubmissions.mockReturnValue({
      submissions: [approvedEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });

    renderPageFor("approved-event-id");

    expect(await screen.findByText("Host My Events page")).toBeInTheDocument();
  });
});

describe("UserEventEditPage withdrawal safety", () => {
  it("disables the confirm button and shows a pending label while withdrawal is in flight", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    let resolveDelete: (() => void) | undefined;
    mocks.deleteEventForUser.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        })
    );

    renderPage();
    await screen.findByDisplayValue("Pending Event");
    fireEvent.click(screen.getByRole("button", { name: /^Withdraw submission$/ }));
    const allButtons = await screen.findAllByRole("button", { name: /Withdraw submission/i });
    fireEvent.click(allButtons[1]);

    await waitFor(() => expect(mocks.deleteEventForUser).toHaveBeenCalledTimes(1));
    const pendingButton = await screen.findByRole("button", { name: /Withdrawing/i });
    expect(pendingButton).toBeDisabled();

    resolveDelete?.();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows an accessible error and preserves the form when withdrawal fails", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    mocks.deleteEventForUser.mockRejectedValueOnce(new Error("Withdrawal network error"));

    renderPage();
    await screen.findByDisplayValue("Pending Event");
    fireEvent.click(screen.getByRole("button", { name: /^Withdraw submission$/ }));
    const allButtons = await screen.findAllByRole("button", { name: /Withdraw submission/i });
    fireEvent.click(allButtons[1]);

    const errorMessage = await screen.findByText(/❌ Withdrawal network error/i);
    expect(errorMessage).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toContainElement(errorMessage);
    expect(errorMessage.closest('[role="alert"]')).not.toBeNull();
    expect(screen.getByDisplayValue("Pending Event")).toBeInTheDocument();
  });
});

describe("UserEventEditPage unsaved-change protection", () => {
  it("warns before unload once a field has changed", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });

    renderPage();
    const titleInput = await screen.findByDisplayValue("Pending Event");
    fireEvent.change(titleInput, { target: { value: "Changed Title" } });

    const event = new Event("beforeunload", { cancelable: true });
    const preventDefault = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
  });

  it("does not warn before unload when nothing has changed", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });

    renderPage();
    await screen.findByDisplayValue("Pending Event");

    const event = new Event("beforeunload", { cancelable: true });
    const preventDefault = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("clears the unsaved-change warning after a successful save", async () => {
    mocks.useMySubmissions.mockReturnValue({
      submissions: [pendingEvent],
      approvedEvents: [],
      isLoading: false,
      error: null,
    });
    mocks.updateEventForUser.mockResolvedValueOnce(undefined);

    renderPage();
    const titleInput = await screen.findByDisplayValue("Pending Event");
    fireEvent.change(titleInput, { target: { value: "Changed Title" } });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await screen.findByRole("status");

    const event = new Event("beforeunload", { cancelable: true });
    const preventDefault = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefault).not.toHaveBeenCalled();
  });
});
