import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as submissionsRepo from "../features/admin/api/submissionsRepo";
import SubmitEventPage from "./SubmitEventPage";
import { CityProvider } from "../contexts/CityContext";
const { useSubmissionAccess } = vi.hoisted(() => ({ useSubmissionAccess: vi.fn() }));
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock("../features/events/api/eventsRepo", () => ({}));

vi.mock("../features/admin/api/submissionsRepo", () => ({
  createSubmission: vi.fn(),
}));

vi.mock("../features/submit-event/useSubmissionAccess", () => ({ useSubmissionAccess }));

vi.mock("../contexts/useAuth", () => ({ useAuth }));

const renderSubmitEventPage = () =>
  render(
    <CityProvider>
      <SubmitEventPage />
    </CityProvider>
  );

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
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
  });

  it("renders the event submission form", () => {
    renderSubmitEventPage();

    expect(screen.getByRole("heading", { name: /Submit an Event/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title \*/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Event type/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /City/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Date \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Venue Name/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Price/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Your Name/i)).toBeInTheDocument();
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
    vi.mocked(submissionsRepo.createSubmission).mockResolvedValueOnce();

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
      })
    );

    expect(await screen.findByText(/Event Submitted!/i)).toBeInTheDocument();
  });

  it("persists a supplied start time as its New York instant", async () => {
    vi.mocked(submissionsRepo.createSubmission).mockResolvedValueOnce();

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
        })
      );
    });
  });

  it("displays an error message when submission fails", async () => {
    vi.mocked(submissionsRepo.createSubmission).mockRejectedValueOnce(
      new Error("Network connection error")
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

    expect(await screen.findByText(/❌ Network connection error/i)).toBeInTheDocument();
  });

  it("allows resetting the form from success card to submit another event", async () => {
    vi.mocked(submissionsRepo.createSubmission).mockResolvedValueOnce();

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

    expect(await screen.findByText(/❌ Network error/i)).toBeInTheDocument();
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
