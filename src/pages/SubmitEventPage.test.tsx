import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SubmitEventPage from "./SubmitEventPage";
import { Providers } from "../app/providers";
import * as eventsRepo from "../features/events/api/eventsRepo";

vi.mock("../features/events/api/eventsRepo", () => ({
  submitEvent: vi.fn(),
}));

vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@example.com" },
    session: null,
    loading: false,
    isAdmin: false,
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  }),
}));

const renderSubmitEventPage = () =>
  render(
    <Providers>
      <SubmitEventPage />
    </Providers>
  );

describe("SubmitEventPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the event submission form", () => {
    renderSubmitEventPage();

    expect(
      screen.getByRole("heading", { name: /Submit an Event/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Event Type \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/City \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Venue Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Your Name/i)).toBeInTheDocument();
  });

  it("submits the form successfully and displays success card", async () => {
    vi.mocked(eventsRepo.submitEvent).mockResolvedValueOnce();

    renderSubmitEventPage();

    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Saturday Bachata Night" },
    });
    fireEvent.change(screen.getByLabelText(/Event Type \*/i), {
      target: { value: "social" },
    });
    fireEvent.change(screen.getByLabelText(/Date \*/i), {
      target: { value: "2026-08-15" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));

    await waitFor(() => {
      expect(eventsRepo.submitEvent).toHaveBeenCalledTimes(1);
    });

    expect(eventsRepo.submitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Saturday Bachata Night",
        event_type: "social",
        event_date: "2026-08-15T00:00:00",
        city: "boston",
      })
    );

    expect(
      await screen.findByText(/Event Submitted!/i)
    ).toBeInTheDocument();
  });

  it("displays an error message when submission fails", async () => {
    vi.mocked(eventsRepo.submitEvent).mockRejectedValueOnce(
      new Error("Network connection error")
    );

    renderSubmitEventPage();

    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Salsa in the Park" },
    });
    fireEvent.change(screen.getByLabelText(/Event Type \*/i), {
      target: { value: "social" },
    });
    fireEvent.change(screen.getByLabelText(/Date \*/i), {
      target: { value: "2026-08-20" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));

    expect(
      await screen.findByText(/❌ Network connection error/i)
    ).toBeInTheDocument();
  });

  it("allows resetting the form from success card to submit another event", async () => {
    vi.mocked(eventsRepo.submitEvent).mockResolvedValueOnce();

    renderSubmitEventPage();

    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Mambo Workshop" },
    });
    fireEvent.change(screen.getByLabelText(/Event Type \*/i), {
      target: { value: "workshop" },
    });
    fireEvent.change(screen.getByLabelText(/Date \*/i), {
      target: { value: "2026-08-25" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit Event/i }));

    const resetButton = await screen.findByRole("button", {
      name: /Submit Another Event/i,
    });
    fireEvent.click(resetButton);

    expect(
      screen.getByRole("heading", { name: /Submit an Event/i })
    ).toBeInTheDocument();
    expect(
      (screen.getByLabelText(/Event Title \*/i) as HTMLInputElement).value
    ).toBe("");
  });
});
