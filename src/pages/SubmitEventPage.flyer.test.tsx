import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("../contexts/useAuth", () => ({ useAuth: () => ({ user: mockAuth.user }) }));
vi.mock("../contexts/useCity", () => ({ useCity: () => ({ city: "boston" }) }));
vi.mock("../features/submit-event/useSubmissionAccess", () => ({
  useSubmissionAccess: mockSubmissionAccess.useSubmissionAccess,
}));
vi.mock("../features/admin/api/submissionsRepo", () => ({
  createSubmission: vi.fn(),
}));
vi.mock("../features/events/api/eventFlyers", () => ({
  uploadEventFlyer: mockEventFlyers.uploadEventFlyer,
  removeEventFlyer: mockEventFlyers.removeEventFlyer,
  validateEventFlyer: (file: File) =>
    ["image/jpeg", "image/png", "image/webp"].includes(file.type)
      ? null
      : "Choose a JPEG, PNG, or WebP image.",
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
    // jsdom does not implement Element.scrollIntoView; stub so the Coming Soon
    // "Continue Manually" flow (which focuses the form) does not crash the test.
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
  });

  it("exposes a flyer-first entry point with a dropzone", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /Start with a flyer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose Flyer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue manually/i })).toBeInTheDocument();
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

  it("opens an honest Coming Soon notice (not a silent no-op) and returns to manual entry", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.upload(
      screen.getByLabelText("Event flyer"),
      new File(["png"], "havana-friday.png", { type: "image/png" })
    );
    await screen.findByRole("button", { name: /Extract Event Details/i });

    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    const dialog = await screen.findByRole("dialog", { name: /Extract Event Details/i });
    expect(dialog).toHaveTextContent(/Coming soon/i);
    expect(dialog).toHaveTextContent(/AI flyer extraction is coming soon/i);
    expect(dialog).toHaveTextContent(/Your flyer is already saved/i);

    await user.click(within(dialog).getByRole("button", { name: /Continue Manually/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title \*/i)).toBeInTheDocument();
  });

  it("persists the uploaded flyer URL into submitted_data on submit — one upload only", async () => {
    const user = userEvent.setup();
    vi.mocked(submissionsRepo.createSubmission).mockResolvedValueOnce();

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
    vi.mocked(submissionsRepo.createSubmission).mockResolvedValueOnce();
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
    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));

    await waitFor(() => {
      expect(submissionsRepo.createSubmission).toHaveBeenCalledTimes(1);
    });
    // No flyer persisted for a guest.
    const [, extra] = vi.mocked(submissionsRepo.createSubmission).mock.calls[0];
    expect(extra).toBeUndefined();
  });
});
