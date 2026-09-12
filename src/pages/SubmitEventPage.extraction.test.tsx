import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
const mockFlyerExtraction = vi.hoisted(() => ({
  extractEventFromFlyer: vi.fn(),
}));
const mockReconciliation = vi.hoisted(() => ({ reconcileVenue: vi.fn() }));


vi.mock("../contexts/useAuth", () => ({ useAuth: () => ({ user: mockAuth.user }) }));
vi.mock("../contexts/useCity", () => ({ useCity: () => ({ city: "boston" }) }));
vi.mock("../features/submit-event/hooks/useSubmissionAccess", () => ({
  useSubmissionAccess: mockSubmissionAccess.useSubmissionAccess,
}));
vi.mock("../features/admin/api/submissionsRepo", () => ({
  createSubmission: vi.fn(),
}));
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
vi.mock("../features/flyer-extraction/client", () => mockFlyerExtraction);
vi.mock("../features/entity-matching/reconcileClient", () => mockReconciliation);


const FLYER_URL =
  "https://project.supabase.co/storage/v1/object/public/event-flyers/test-user-id/submission-abc/havana.png";

const FULL_EXTRACTION = {
  title: "Boston Salsa Night",
  date: "2026-09-18",
  start_time: "21:00",
  end_time: "01:00",
  venue_name: "Havana Club",
  address: "288 Green Street",
  city: "Cambridge",
  dance_styles: ["Salsa", "Bachata"],
  event_type: "Social",
  price: "$20",
  organizer_name: "SalsaSegura",
  instagram: "@salsasegura",
  website: "https://salsasegura.com",
  details: ["21+"],
};

const PARTIAL_EXTRACTION = {
  title: "Latin Night",
  date: "2026-10-05",
  start_time: "20:00",
  end_time: null,
  venue_name: "Casa Latina",
  address: null,
  city: "Boston",
  dance_styles: ["Salsa"],
  event_type: null,
  price: null,
  organizer_name: null,
  instagram: null,
  website: null,
  details: [],
};



const renderPage = () => {
  const rendered = render(<SubmitEventPage />);
  fireEvent.click(screen.getByRole("button", { name: /Choose to upload a flyer to start/i }));
  return rendered;
};

const uploadFlyer = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.upload(
    screen.getByLabelText("Event flyer"),
    new File(["png"], "havana-friday.png", { type: "image/png" })
  );
  await screen.findByRole("button", { name: /Extract Event Details/i });
};

describe("SubmitEventPage flyer extraction (Phase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mockReconciliation.reconcileVenue.mockResolvedValue({ venue: { status: "none", match: null } });
  });

  it("shows no extraction button before a flyer is persisted", () => {
    renderPage();
    expect(
      screen.queryByRole("button", { name: /Extract Event Details/i })
    ).not.toBeInTheDocument();
  });

  it("shows a real Analyzing… loading state while the request is in flight", async () => {
    let resolveExtraction!: (value: typeof FULL_EXTRACTION) => void;
    mockFlyerExtraction.extractEventFromFlyer.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExtraction = resolve;
      })
    );
    const user = userEvent.setup();
    renderPage();
    await uploadFlyer(user);

    fireEvent.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    expect(await screen.findByText(/Analyzing your flyer/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Extract Event Details/i })
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveExtraction(FULL_EXTRACTION);
    });
    expect(screen.getByText(/Flyer analyzed/i)).toBeInTheDocument();
  });

  it("runs extraction and displays a full result", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(FULL_EXTRACTION);
    renderPage();
    await uploadFlyer(user);

    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    expect(await screen.findByText(/Flyer analyzed/i)).toBeInTheDocument();
    expect(screen.getByText("Boston Salsa Night")).toBeInTheDocument();
    expect(screen.getByText("September 18, 2026")).toBeInTheDocument();
    expect(screen.getByText("9:00 PM – 1:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Havana Club")).toBeInTheDocument();
    expect(screen.getByText("@salsasegura")).toBeInTheDocument();
    // A full extraction has nothing missing — no partial-results note.
    expect(screen.queryByText(/wasn't visible on the flyer/i)).not.toBeInTheDocument();
  });
  it.each([
    ["exact", /Matched to an existing SalsaSegura venue\./i],
    ["strong", /Matched to an existing SalsaSegura venue\./i],
  ] as const)("shows a restrained known venue notice for %s reconciliation", async (status, notice) => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(FULL_EXTRACTION);
    mockReconciliation.reconcileVenue.mockResolvedValueOnce({
      venue: {
        status,
        match: { id: "v1", name: "Havana Club", address: null, city: "Boston" },
      },
    });
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));
    expect(await screen.findByText(notice)).toBeInTheDocument();
  });
  it("shows only populated fields and a partial-results note for an incomplete flyer", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(PARTIAL_EXTRACTION);
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    expect(await screen.findByText("Latin Night")).toBeInTheDocument();
    const panel = screen.getByText(/Flyer analyzed/i).closest(".flyer-extraction-panel");
    if (!panel) throw new Error("extraction panel not found");
    expect(within(panel as HTMLElement).getByText("Casa Latina")).toBeInTheDocument();
    expect(within(panel as HTMLElement).queryByText("Address")).not.toBeInTheDocument();
    expect(within(panel as HTMLElement).queryByText("Price")).not.toBeInTheDocument();
    expect(within(panel as HTMLElement).queryByText("Organizer")).not.toBeInTheDocument();
    expect(within(panel as HTMLElement).queryByText("Instagram")).not.toBeInTheDocument();
    expect(within(panel as HTMLElement).queryByText("Website")).not.toBeInTheDocument();
    expect(screen.getByText(/wasn't visible on the flyer/i)).toBeInTheDocument();
  });


  it("silently falls back for an ambiguous venue match", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(FULL_EXTRACTION);
    mockReconciliation.reconcileVenue.mockResolvedValueOnce({
      venue: { status: "ambiguous", match: null },
    });
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    expect(await screen.findByText("Havana Club")).toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("Boston Salsa Night");
    expect(screen.queryByText(/No confident venue match found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Venue enrichment is unavailable/i)).not.toBeInTheDocument();
  });

  it("silently falls back for an unknown venue", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(FULL_EXTRACTION);
    mockReconciliation.reconcileVenue.mockResolvedValueOnce({
      venue: { status: "none", match: null },
    });
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    expect(await screen.findByText("Havana Club")).toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("Boston Salsa Night");
    expect(screen.queryByText(/No confident venue match found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Venue enrichment is unavailable/i)).not.toBeInTheDocument();
  });

  it("silently falls back when venue reconciliation fails", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(FULL_EXTRACTION);
    mockReconciliation.reconcileVenue.mockRejectedValueOnce(new Error("network failure"));
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    expect(await screen.findByText("Havana Club")).toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("Boston Salsa Night");
    expect(screen.queryByText(/Venue enrichment is unavailable/i)).not.toBeInTheDocument();
  });


  it("shows a safe failure message with Try Again and Continue manually, and never blocks the form", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockRejectedValueOnce(
      new Error("We couldn't read this flyer. Please try again.")
    );
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/we couldn't read this flyer/i);
    // Never leaks internals.
    expect(alert).not.toHaveTextContent(/openai|bearer|supabase|stack|502/i);

    expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue manually/i })).toBeInTheDocument();
    // The manual form is still fully usable during/after a failed extraction.
    fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
      target: { value: "Manual Title" },
    });
    expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("Manual Title");
  });

  it("retries after a failure into a successful result", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockRejectedValueOnce(new Error("network blip"));
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));
    await screen.findByRole("alert");

    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(FULL_EXTRACTION);
    await user.click(screen.getByRole("button", { name: /Try Again/i }));

    expect(await screen.findByText(/Flyer analyzed/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the result immediately when the flyer identity changes", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(FULL_EXTRACTION);
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));
    expect(await screen.findByText(/Flyer analyzed/i)).toBeInTheDocument();

    // "Replace" is a pre-existing dead affordance in EventFlyerField once a
    // flyer is uploaded (its hidden file input unmounts with the dropzone),
    // unrelated to this feature — remove-then-reupload is the UI path that
    // actually changes the flyer identity today, exercising the same
    // resetExtraction() call handleFlyerChange makes on a real replace.
    await user.click(screen.getByRole("button", { name: /Remove/i }));
    expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument();

    await uploadFlyer(user);
    expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Extract Event Details/i })
    ).toBeInTheDocument();
  });

  it("clears the result and button when the flyer is removed", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(FULL_EXTRACTION);
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));
    expect(await screen.findByText(/Flyer analyzed/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Remove/i }));

    expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Extract Event Details/i })
    ).not.toBeInTheDocument();
  });

  it("a stale response cannot prefill the form once its flyer has been removed", async () => {
    let resolveExtraction!: (value: typeof FULL_EXTRACTION) => void;
    mockFlyerExtraction.extractEventFromFlyer.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExtraction = resolve;
      })
    );
    const user = userEvent.setup();
    renderPage();
    await uploadFlyer(user);

    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));
    expect(screen.getByText(/Analyzing your flyer/i)).toBeInTheDocument();

    // Remove the flyer while extraction is still in flight.
    await user.click(screen.getByRole("button", { name: /Remove/i }));
    expect(screen.queryByLabelText(/Event Title \*/i)).toHaveValue("");

    // The stale request now resolves — it must reach neither the panel nor
    // the form, even though it would have been a perfectly valid result.
    await act(async () => {
      resolveExtraction(FULL_EXTRACTION);
    });

    expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: /Extract Event Details/i })
    ).not.toBeInTheDocument();
  });
});
