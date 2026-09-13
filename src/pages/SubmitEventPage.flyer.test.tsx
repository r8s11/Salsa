import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import * as submissionsRepo from "../features/admin/api/submissionsRepo";
import SubmitEventPage from "./SubmitEventPage";

const mockAuth = vi.hoisted(() => ({
  user: { id: "test-user-id", email: "test@example.com" } as {
    id: string;
    email: string;
  } | null,
}));
const mockSubmissionAccess = vi.hoisted(() => ({ useSubmissionAccess: vi.fn() }));
const mockEventFlyers = vi.hoisted(() => ({
  uploadEventFlyer: vi.fn(),
  removeEventFlyer: vi.fn(),
}));
const mockExtractionClient = vi.hoisted(() => ({ extractEventFromFlyer: vi.fn() }));
const mockReconciliation = vi.hoisted(() => ({ reconcileVenue: vi.fn() }));

vi.mock("../features/entity-matching/reconcileClient", () => mockReconciliation);


vi.mock("../contexts/useAuth", () => ({ useAuth: () => ({ user: mockAuth.user }) }));
vi.mock("../contexts/useCity", () => ({ useCity: () => ({ city: "boston" }) }));
vi.mock("../features/submit-event/hooks/useSubmissionAccess", () => ({
  useSubmissionAccess: mockSubmissionAccess.useSubmissionAccess,
}));
vi.mock("../features/admin/api/submissionsRepo", () => ({
  createSubmission: vi.fn(),
}));
// Mocked so the normal test suite can never reach the Edge Function/Resend.
vi.mock("../features/submit-event/api/submissionNotification", () => ({
  notifySubmissionReceived: vi.fn(),
}));
vi.mock("../features/events/api/eventFlyers", () => ({
  uploadEventFlyer: mockEventFlyers.uploadEventFlyer,
  removeEventFlyer: mockEventFlyers.removeEventFlyer,
  validateEventFlyer: (file: File) =>
    ["image/jpeg", "image/png", "image/webp"].includes(file.type)
      ? null
      : "Choose a JPEG, PNG, or WebP image.",
}));
vi.mock("../features/flyer-extraction/client", () => ({
  extractEventFromFlyer: mockExtractionClient.extractEventFromFlyer,
}));

const FLYER_URL =
  "https://project.supabase.co/storage/v1/object/public/event-flyers/test-user-id/submission-abc/havana.png";

const renderPage = () => {
  const rendered = render(<SubmitEventPage />);
  fireEvent.click(screen.getByRole("button", { name: /Choose to upload a flyer to start/i }));
  return rendered;
};

describe("SubmitEventPage flyer (Phase 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom does not implement Element.scrollIntoView; stub so the extract-and-focus
    // flow (which focuses the form) does not crash the test.
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
    mockAuth.user = { id: "test-user-id", email: "test@example.com" };
    mockSubmissionAccess.useSubmissionAccess.mockReturnValue({
      isLoading: false,
      canSubmit: true,
      error: null,
    });
    mockEventFlyers.uploadEventFlyer.mockResolvedValue({
      path: "test-user-id/submission-abc/havana.png",
      url: FLYER_URL,
    });
    mockEventFlyers.removeEventFlyer.mockResolvedValue(undefined);
    mockReconciliation.reconcileVenue.mockResolvedValue({
      venue: { status: "none", match: null },
    });
  });

  it("flows directly from the flyer section into the event form without a manual continuation control", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /Start with a flyer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose Flyer/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continue manually/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title \*/i)).toBeInTheDocument();
  });

  it("does not force flyer upload — manual entry remains available", () => {
    renderPage();
    // The canonical form is present without a flyer chosen.
    expect(screen.getByLabelText(/Event Title \*/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit Event/i })).toBeInTheDocument();
  });

  it("reveals Extract Event Details only after the flyer is PERSISTED, not merely selected", async () => {
    const user = userEvent.setup();
    let resolveUpload!: (value: { path: string; url: string }) => void;
    mockEventFlyers.uploadEventFlyer.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve;
      })
    );
    renderPage();

    expect(
      screen.queryByRole("button", { name: /Extract Event Details/i })
    ).not.toBeInTheDocument();

    await user.upload(
      screen.getByLabelText("Event flyer"),
      new File(["png"], "havana-friday.png", { type: "image/png" })
    );

    // While the upload is in flight, the flyer is NOT ready yet.
    expect(
      screen.queryByRole("button", { name: /Extract Event Details/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Uploading…")).toBeInTheDocument();

    await act(async () => {
      resolveUpload({ path: "test-user-id/submission-abc/havana.png", url: FLYER_URL });
    });

    expect(
      await screen.findByRole("button", { name: /Extract Event Details/i })
    ).toBeInTheDocument();
  });

  const uploadFlyerAndExtract = async (user: UserEvent) => {
    renderPage();
    await user.upload(
      screen.getByLabelText("Event flyer"),
      new File(["png"], "havana-friday.png", { type: "image/png" })
    );
    await screen.findByRole("button", { name: /Extract Event Details/i });
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));
  };

  it("fills the form from the extraction and reports what was filled", async () => {
    const user = userEvent.setup();
    mockExtractionClient.extractEventFromFlyer.mockResolvedValue({
      title: "Havana Friday Social",
      date: "2026-09-18",
      start_time: "21:00",
      end_time: null,
      venue_name: "Havana Club",
      address: null,
      city: "Brooklyn",
      dance_styles: ["Salsa"],
      event_type: "Social",
      price: "$20",
      organizer_name: null,
      instagram: null,
      website: null,
      details: [],
    });

    await uploadFlyerAndExtract(user);

    expect(mockExtractionClient.extractEventFromFlyer).toHaveBeenCalledWith(FLYER_URL);
    expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("Havana Friday Social");
    expect(screen.getByLabelText(/Date \*/i)).toHaveValue("2026-09-18");
    expect(screen.getByRole("button", { name: "New York City" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(/Filled .* from your flyer/i);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaves unmappable fields alone and says what it could not determine", async () => {
    const user = userEvent.setup();
    mockExtractionClient.extractEventFromFlyer.mockResolvedValue({
      title: "Warehouse Party",
      date: null,
      start_time: null,
      end_time: null,
      venue_name: null,
      address: null,
      city: "Cambridgeport",
      dance_styles: [],
      event_type: null,
      price: "Suggested donation",
      organizer_name: null,
      instagram: null,
      website: null,
      details: [],
    });

    await uploadFlyerAndExtract(user);

    expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("Warehouse Party");
    expect(screen.getByRole("button", { name: "Boston" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(/Couldn't determine: city, price/i);
  });

  it("shows the extraction failure without touching the form", async () => {
    const user = userEvent.setup();
    mockExtractionClient.extractEventFromFlyer.mockRejectedValue(
      new Error("We couldn't read this flyer. Please try again.")
    );

    await uploadFlyerAndExtract(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(/We couldn't read this flyer/i);
    expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("");
  });

  it("persists the uploaded flyer URL into submitted_data on submit — one upload only", async () => {
    const user = userEvent.setup();
    vi.mocked(submissionsRepo.createSubmission).mockResolvedValueOnce("submission-id");

    renderPage();

    await user.upload(
      screen.getByLabelText("Event flyer"),
      new File(["png"], "havana-friday.png", { type: "image/png" })
    );
    await screen.findByRole("button", { name: /Extract Event Details/i });

    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Havana Friday" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Social/i }));
    fireEvent.change(screen.getByLabelText(/Date \*/i), {
      target: { value: "2026-09-04" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));

    await waitFor(() => {
      expect(submissionsRepo.createSubmission).toHaveBeenCalledTimes(1);
    });

    const [, extra] = vi.mocked(submissionsRepo.createSubmission).mock.calls[0];
    expect(extra).toEqual({ image_url: FLYER_URL });
    expect(mockEventFlyers.uploadEventFlyer).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Event Submitted!/i)).toBeInTheDocument();
  });

  it("shows an upload failure with a Try Again affordance and never claims ready", async () => {
    const user = userEvent.setup();
    mockEventFlyers.uploadEventFlyer.mockRejectedValueOnce(new Error("storage down"));
    renderPage();

    await user.upload(
      screen.getByLabelText("Event flyer"),
      new File(["png"], "havana-friday.png", { type: "image/png" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/storage down/i);
    expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Extract Event Details/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Try Again/i }));
    expect(
      await screen.findByRole("button", { name: /Extract Event Details/i })
    ).toBeInTheDocument();
  });

  it("submits without a flyer when the guest is not authenticated", async () => {
    mockAuth.user = null;
    vi.mocked(submissionsRepo.createSubmission).mockResolvedValueOnce("submission-id");
    renderPage();

    // Guests are not offered the flyer upload — only an honest note.
    expect(screen.queryByLabelText("Event flyer")).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/signed in to upload a flyer/i);

    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Guest Social" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Social/i }));
    fireEvent.change(screen.getByLabelText(/Date \*/i), {
      target: { value: "2026-09-05" },
    });
    // Anonymous submissions now require submitter contact details — they are
    // the only channel for the confirmation and review-outcome emails.
    fireEvent.change(screen.getByLabelText(/Your name/i), {
      target: { value: "Guest Dancer" },
    });
    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));

    await waitFor(() => {
      expect(submissionsRepo.createSubmission).toHaveBeenCalledTimes(1);
    });
    // No flyer persisted for a guest.
    const [, extra] = vi.mocked(submissionsRepo.createSubmission).mock.calls[0];
    expect(extra).toBeUndefined();
  });
});
