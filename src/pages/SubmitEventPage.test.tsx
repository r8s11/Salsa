import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import * as submissionsRepo from "../features/admin/api/submissionsRepo";
import SubmitEventPage from "./SubmitEventPage";
import { CityProvider } from "../contexts/CityContext";
const { useSubmissionAccess } = vi.hoisted(() => ({ useSubmissionAccess: vi.fn() }));
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock("../features/events/api/eventsRepo", () => ({}));

vi.mock("../features/admin/api/submissionsRepo", () => ({
  createSubmission: vi.fn(),
}));

// The submit path fires the transactional emails fire-and-forget. Mocked so
// the normal test suite can never reach the Edge Function or Resend.
vi.mock("../features/submit-event/submissionNotification", () => ({
  notifySubmissionReceived: vi.fn(),
}));

vi.mock("../features/submit-event/useSubmissionAccess", () => ({ useSubmissionAccess }));

vi.mock("../contexts/useAuth", () => ({ useAuth }));

const renderSubmitEventPage = () => {
  const rendered = render(
    <CityProvider>
      <SubmitEventPage />
    </CityProvider>
  );
  const manualEntry = screen.queryByRole("button", {
    name: /Choose to enter event details manually/i,
  });
  if (manualEntry) fireEvent.click(manualEntry);
  return rendered;
};

const chooseEventType = (name: "Social" | "Class" | "Workshop") =>
  fireEvent.click(screen.getByRole("button", { name }));

describe("SubmitEventPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSubmissionAccess).mockReturnValue({
      isLoading: false,
      canSubmit: true,
      error: null,
    });
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "test-user-id", email: "test@example.com" },
      session: null,
      loading: false,
      isAdmin: false,
      isOrganizer: false,
      signInWithPassword: vi.fn(),
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
  });
  it("requires an explicit flyer or manual entry choice", () => {
    render(
      <CityProvider>
        <SubmitEventPage />
      </CityProvider>
    );

    expect(screen.getByRole("group", { name: /How would you like to start/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Choose to upload a flyer to start/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Choose to enter event details manually/i })
    ).toBeInTheDocument();
  });

  it("renders the event submission form with noValidate and a required legend", () => {
    renderSubmitEventPage();

    expect(screen.getByRole("heading", { name: /Submit an Event/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title \*/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Event type/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /City/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Date \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Venue Name/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Price/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Your Name/i)).toBeInTheDocument();
    expect(document.querySelector("form.submit-form")).toHaveAttribute("noValidate", "");
    expect(screen.getByText("* Required")).toBeInTheDocument();
  });

  it("replaces the form with a closed-state message when registered submissions are disabled", () => {
    vi.mocked(useSubmissionAccess).mockReturnValue({
      isLoading: false,
      canSubmit: false,
      error: null,
    });

    renderSubmitEventPage();

    expect(screen.getByText("Event submissions are currently closed.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit Event/i })).not.toBeInTheDocument();
  });

  it("submits the form successfully and displays success card", async () => {
    vi.mocked(submissionsRepo.createSubmission).mockResolvedValueOnce("submission-id");

    renderSubmitEventPage();

    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Saturday Bachata Night" },
    });
    chooseEventType("Social");
    fireEvent.change(screen.getByLabelText(/Date \*/i), {
      target: { value: "2026-08-15" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));

    await waitFor(() => {
      expect(submissionsRepo.createSubmission).toHaveBeenCalledTimes(1);
    });

    expect(submissionsRepo.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Saturday Bachata Night",
        event_type: "social",
        event_date: "2026-08-15T04:00:00Z",
        city: "boston",
      }),
      undefined
    );

    expect(await screen.findByText(/Event Submitted!/i)).toBeInTheDocument();
  });

  it("persists a supplied start time as its New York instant", async () => {
    vi.mocked(submissionsRepo.createSubmission).mockResolvedValueOnce("submission-id");

    renderSubmitEventPage();

    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Boston Summer Social" },
    });
    chooseEventType("Social");
    fireEvent.change(screen.getByLabelText(/Date \*/i), {
      target: { value: "2026-08-17" },
    });
    fireEvent.change(screen.getByLabelText(/Start Time/i), {
      target: { value: "20:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));

    await waitFor(() => {
      expect(submissionsRepo.createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          event_date: "2026-08-18T00:00:00Z",
          event_time: "20:00",
        }),
        undefined
      );
    });
  });

  // ── Field-level validation + error summary (P2-4) ──

  it("reports every missing required field at once on an empty submit, including event type and city", async () => {
    renderSubmitEventPage();

    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));

    const summary = await screen.findByText("Please fix the following:");
    const summaryContainer = summary.closest("#submit-error-summary") as HTMLElement;
    expect(summaryContainer).toBeInTheDocument();
    expect(summaryContainer).toHaveTextContent(/enter an event title/i);
    expect(summaryContainer).toHaveTextContent(/choose an event type/i);
    expect(summaryContainer).toHaveTextContent(/choose an event date/i);
    expect(submissionsRepo.createSubmission).not.toHaveBeenCalled();

    const titleInput = screen.getByLabelText(/Event Title \*/i);
    expect(titleInput).toHaveAttribute("aria-invalid", "true");
    expect(titleInput).toHaveAttribute("aria-describedby", "event-title-error");
    expect(document.getElementById("event-title-error")).toHaveTextContent(
      /enter an event title/i
    );

    const eventTypeGroup = screen.getByRole("group", { name: /Event type/i });
    expect(eventTypeGroup).toHaveAttribute("aria-invalid", "true");
    expect(eventTypeGroup).toHaveAttribute("aria-describedby", "event-type-error");

    const link = within(summaryContainer).getByRole("link", { name: /enter an event title/i });
    expect(link).toHaveAttribute("href", "#event-title");
  });

  it("focuses and re-focuses the error summary on each failed validation submit", async () => {
    renderSubmitEventPage();

    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));
    const summary = (await screen.findByText("Please fix the following:")).closest(
      "#submit-error-summary"
    ) as HTMLElement;
    await waitFor(() => expect(summary).toHaveFocus());

    // Fix nothing, submit again — same errors, but the summary must refocus.
    (summary as HTMLElement).blur();
    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));
    await waitFor(() => expect(summary).toHaveFocus());
  });

  it("clears a field's error and aria-invalid as soon as its value changes", async () => {
    renderSubmitEventPage();

    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));
    await screen.findByText("Please fix the following:");

    const titleInput = screen.getByLabelText(/Event Title \*/i);
    expect(titleInput).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(titleInput, { target: { value: "Now filled in" } });

    expect(titleInput).toHaveAttribute("aria-invalid", "false");
    expect(document.getElementById("event-title-error")).not.toBeInTheDocument();
  });

  it("shows safe, actionable copy (never raw provider text) on a rejected submit, and focuses the summary", async () => {
    vi.mocked(submissionsRepo.createSubmission).mockRejectedValueOnce(
      new Error("duplicate key value violates unique constraint")
    );

    renderSubmitEventPage();

    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Salsa in the Park" },
    });
    chooseEventType("Social");
    fireEvent.change(screen.getByLabelText(/Date \*/i), {
      target: { value: "2026-08-20" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));

    await waitFor(() => expect(document.getElementById("submit-error-summary")).toBeInTheDocument());
    const summary = document.getElementById("submit-error-summary") as HTMLElement;
    expect(summary).toHaveTextContent(/We couldn't submit your event\. Please try again\./i);
    expect(summary).not.toHaveTextContent(/duplicate key|constraint/i);
    await waitFor(() => expect(summary).toHaveFocus());

    // Values survive the failed submit.
    expect((screen.getByLabelText(/Event Title \*/i) as HTMLInputElement).value).toBe(
      "Salsa in the Park"
    );
  });

  it("keeps submit disabled while a submission is in flight", async () => {
    let resolveSubmit!: (id: string) => void;
    vi.mocked(submissionsRepo.createSubmission).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      })
    );

    renderSubmitEventPage();

    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Pending Event" },
    });
    chooseEventType("Social");
    fireEvent.change(screen.getByLabelText(/Date \*/i), { target: { value: "2026-08-20" } });

    const submitButton = screen.getByRole("button", { name: /Submit Event/i });
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitButton).toBeDisabled());
    resolveSubmit("submission-id");
    await screen.findByText(/Event Submitted!/i);
  });

  it("allows resetting the form from success card to submit another event", async () => {
    vi.mocked(submissionsRepo.createSubmission).mockResolvedValueOnce("submission-id");

    renderSubmitEventPage();

    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Mambo Workshop" },
    });
    chooseEventType("Workshop");
    fireEvent.change(screen.getByLabelText(/Date \*/i), {
      target: { value: "2026-08-25" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));

    const resetButton = await screen.findByRole("button", {
      name: /Submit Another Event/i,
    });
    fireEvent.click(resetButton);

    expect(screen.getByRole("heading", { name: /Submit an Event/i })).toBeInTheDocument();
    expect((screen.getByLabelText(/Event Title \*/i) as HTMLInputElement).value).toBe("");
  });

  it("shows the Host workspace heading and a truthful review notice for an approved organizer", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "host-1", email: "host@example.com" },
      session: null,
      loading: false,
      isAdmin: false,
      isOrganizer: true,
      signInWithPassword: vi.fn(),
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    renderSubmitEventPage();

    expect(screen.getByText("Host · Create Event")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create a new event" })).toBeInTheDocument();
    expect(
      screen.getByText(/goes through moderation review before it appears on the calendar/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeInTheDocument();
  });

  it("keeps the public submission heading and button label for a non-organizer visitor", () => {
    renderSubmitEventPage();

    expect(screen.queryByText("Host · Create Event")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Submit an Event" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Event" })).toBeInTheDocument();
  });

  it("preserves entered form data after a failed organizer submission", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "host-1", email: "host@example.com" },
      session: null,
      loading: false,
      isAdmin: false,
      isOrganizer: true,
      signInWithPassword: vi.fn(),
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
    vi.mocked(submissionsRepo.createSubmission).mockRejectedValueOnce(new Error("Network error"));

    renderSubmitEventPage();

    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Havana Nights Social" },
    });
    chooseEventType("Social");
    fireEvent.change(screen.getByLabelText(/Date \*/i), { target: { value: "2026-09-01" } });

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    // "Network error" reads as a network-shaped failure to `publicErrorMessage`
    // (the audit's own regex for "the request never reached the service"), so
    // it collapses to the safe connection copy rather than being echoed raw.
    expect(
      await screen.findByText(/We couldn't reach the server\. Check your connection and try again\./i)
    ).toBeInTheDocument();
    expect((screen.getByLabelText(/Event Title \*/i) as HTMLInputElement).value).toBe(
      "Havana Nights Social"
    );
  });

  it("warns before an unload while the organizer has unsaved input", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "host-1", email: "host@example.com" },
      session: null,
      loading: false,
      isAdmin: false,
      isOrganizer: true,
      signInWithPassword: vi.fn(),
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    renderSubmitEventPage();
    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Havana Nights Social" },
    });

    const event = new Event("beforeunload", { cancelable: true });
    const preventDefault = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
  });

  it("does not warn before an unload when the organizer form is untouched", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "host-1", email: "host@example.com" },
      session: null,
      loading: false,
      isAdmin: false,
      isOrganizer: true,
      signInWithPassword: vi.fn(),
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    renderSubmitEventPage();

    const event = new Event("beforeunload", { cancelable: true });
    const preventDefault = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefault).not.toHaveBeenCalled();
  });
});
