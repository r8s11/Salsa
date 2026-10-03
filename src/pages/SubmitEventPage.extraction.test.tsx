import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CityProvider } from "../contexts/CityContext";
// Registered metros are served by Supabase in production; page tests use a
// stable inventory so no test depends on a production or local database.
vi.mock("../features/metros/hooks/useMetros", () => import("../test/mockMetros"));
import SubmitEventPage from "./SubmitEventPage";
import * as submissionsRepo from "../features/admin/api/submissionsRepo";
import {
  emptyEntityReview,
  type EntityMatch,
  type EntityReview,
  type EntityReviewItem,
} from "../features/entity-matching/entityReview";
import type { ExtractedEvent } from "../features/flyer-extraction/types";
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
const mockEntityReview = vi.hoisted(() => ({
  reconcileEntities: vi.fn(),
  searchEntityMatches: vi.fn(),
}));

vi.mock("../contexts/useAuth", () => ({ useAuth: () => ({ user: mockAuth.user }) }));
vi.mock("../features/account/hooks/useOwnProfile", () => ({
  useOwnProfile: () => ({ profile: null, isLoading: false, error: null, refetch: vi.fn() }),
}));
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
vi.mock("../features/entity-matching/entityReviewClient", () => mockEntityReview);

const FLYER_URL =
  "https://project.supabase.co/storage/v1/object/public/event-flyers/test-user-id/submission-abc/havana.png";

const FULL_EXTRACTION: ExtractedEvent = {
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

const PARTIAL_EXTRACTION: ExtractedEvent = {
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

// Same flyer, but the extractor returned structured entities. A venue only —
// no organizer, instructors or school — keeps the review to one group.
const STRUCTURED_EXTRACTION: ExtractedEvent = {
  ...FULL_EXTRACTION,
  venue: { name: "Havana Club", address: "288 Green Street", city: "Cambridge" },
  organizer: null,
  instructors: [],
  school: null,
};

const EXISTING_VENUE: EntityMatch = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Havana Club & Lounge",
  address: "290 Green Street",
  city: "Brooklyn",
};

const venueItem = (overrides: Partial<EntityReviewItem> = {}): EntityReviewItem => ({
  candidate: { name: "Havana Club", address: "288 Green Street", city: "Cambridge" },
  state: "POSSIBLE MATCH",
  matches: [EXISTING_VENUE],
  decision: "pending",
  selected_id: null,
  ...overrides,
});

const venueReview = (venue: EntityReviewItem): EntityReview => ({
  venue,
  organizer: null,
  instructors: [],
  school: null,
});

const REVIEW_HEADING = "Venue, organizer, instructors and school";
const venueGroup = () => screen.findByRole("group", { name: "Venue: Havana Club" });
// The review section also has "Name"/"Address" inputs; the event form's own
// fields are addressed by id so the two never collide.
const eventAddress = () => document.getElementById("event-address") as HTMLInputElement;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/submit"]}>
      <CityProvider>
        <SubmitEventPage />
      </CityProvider>
    </MemoryRouter>
  );

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
    mockEntityReview.reconcileEntities.mockResolvedValue(emptyEntityReview());
  });

  it("shows no extraction button before a flyer is persisted", () => {
    renderPage();
    expect(
      screen.queryByRole("button", { name: /Extract Event Details/i })
    ).not.toBeInTheDocument();
  });

  it("shows a real Analyzing… loading state while the request is in flight", async () => {
    const extraction = Promise.withResolvers<ExtractedEvent>();
    mockFlyerExtraction.extractEventFromFlyer.mockReturnValueOnce(extraction.promise);
    const user = userEvent.setup();
    renderPage();
    await uploadFlyer(user);

    fireEvent.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    expect(await screen.findByText(/Analyzing your flyer/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Extract Event Details/i })
    ).not.toBeInTheDocument();

    await act(async () => {
      extraction.resolve(FULL_EXTRACTION);
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

  it("prefills the form from an explicitly selected existing venue and says so", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(STRUCTURED_EXTRACTION);
    mockEntityReview.reconcileEntities.mockResolvedValueOnce(
      venueReview(
        venueItem({ state: "MATCHED", decision: "existing", selected_id: EXISTING_VENUE.id })
      )
    );
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    const group = within(await venueGroup());
    expect(group.getByText("Matched")).toBeInTheDocument();
    expect(group.getByText("Using existing venue: Havana Club & Lounge")).toBeInTheDocument();
    // The matched record replaces the flyer's raw venue text and city.
    expect(screen.getByLabelText("Venue Name")).toHaveValue("Havana Club & Lounge");
    expect(eventAddress()).toHaveValue("290 Green Street");
    expect(screen.getByRole("combobox", { name: /City/i })).toHaveValue("new-york-city");
    // The old standalone notice is gone; the review section carries the status.
    expect(screen.queryByText(/Matched to an existing SalsaSegura venue\./i)).not.toBeInTheDocument();
    expect(mockEntityReview.reconcileEntities).toHaveBeenCalledTimes(1);
    expect(mockEntityReview.reconcileEntities.mock.calls[0][0].venue).toMatchObject({
      name: "Havana Club",
      address: "288 Green Street",
      city: "Cambridge",
    });
  });
  it("shows only populated fields and hides the partial-results note", async () => {
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
    // The "Some information wasn't visible on the flyer" note is hidden; the
    // panel shows only what the flyer actually contained.
    expect(screen.queryByText(/wasn't visible on the flyer/i)).not.toBeInTheDocument();
  });

  it("keeps the flyer's venue text for an ambiguous match until the person chooses", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(STRUCTURED_EXTRACTION);
    mockEntityReview.reconcileEntities.mockResolvedValueOnce(venueReview(venueItem()));
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    const group = within(await venueGroup());
    expect(group.getByText("Possible match")).toBeInTheDocument();
    expect(group.getByText(/^Undecided\./)).toBeInTheDocument();
    expect(
      group.getByRole("button", { name: "Use Havana Club & Lounge as the venue" })
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("Boston Salsa Night");
    expect(screen.getByLabelText("Venue Name")).toHaveValue("Havana Club");
    expect(eventAddress()).toHaveValue("288 Green Street");
    expect(screen.queryByText(/We couldn't check these against existing records/i)).not.toBeInTheDocument();
  });

  it("shows an unknown venue as not in our records and keeps the flyer's values", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(STRUCTURED_EXTRACTION);
    mockEntityReview.reconcileEntities.mockResolvedValueOnce(
      venueReview(venueItem({ state: "NEW", matches: [] }))
    );
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    const group = within(await venueGroup());
    expect(group.getByText("Not in our records")).toBeInTheDocument();
    expect(group.queryByRole("list", { name: "Existing venue matches" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("Boston Salsa Night");
    expect(screen.getByLabelText("Venue Name")).toHaveValue("Havana Club");
    expect(eventAddress()).toHaveValue("288 Green Street");
  });

  it("still reviews the flyer's candidates by hand when the records check fails", async () => {
    const user = userEvent.setup();
    mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(FULL_EXTRACTION);
    mockEntityReview.reconcileEntities.mockRejectedValueOnce(new Error("network failure"));
    renderPage();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

    // FULL_EXTRACTION is a legacy payload: the flat venue and organizer
    // fields become the candidates.
    const venue = within(await venueGroup());
    expect(venue.getByText("Needs review")).toBeInTheDocument();
    expect(venue.getByRole("button", { name: "Check for matches" })).toBeInTheDocument();
    const organizer = within(screen.getByRole("group", { name: "Organizer: SalsaSegura" }));
    expect(organizer.getByText("Needs review")).toBeInTheDocument();

    expect(
      screen.getByText("We couldn't check these against existing records. Review them below.")
    ).toBeInTheDocument();
    // Nothing leaks from the failure, and the form is prefilled with raw values.
    expect(screen.queryByText(/network failure/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("Boston Salsa Night");
    expect(screen.getByLabelText("Venue Name")).toHaveValue("Havana Club");
    expect(eventAddress()).toHaveValue("288 Green Street");
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
    expect(screen.getByRole("button", { name: /Extract Event Details/i })).toBeInTheDocument();
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
    const extraction = Promise.withResolvers<ExtractedEvent>();
    mockFlyerExtraction.extractEventFromFlyer.mockReturnValueOnce(extraction.promise);
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
      extraction.resolve(FULL_EXTRACTION);
    });

    expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: /Extract Event Details/i })
    ).not.toBeInTheDocument();
  });

  describe("entity review", () => {
    it("lets an anonymous visitor upload a flyer but offers neither extraction nor review", async () => {
      const user = userEvent.setup();
      mockAuth.user = null;
      renderPage();

      await user.upload(
        screen.getByLabelText("Event flyer"),
        new File(["png"], "guest-flyer.png", { type: "image/png" })
      );

      expect(await screen.findByText("Extract details with AI")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Extract Event Details/i })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: REVIEW_HEADING })).not.toBeInTheDocument();
      expect(mockFlyerExtraction.extractEventFromFlyer).not.toHaveBeenCalled();
      expect(mockEntityReview.reconcileEntities).not.toHaveBeenCalled();
    });

    it("shows the review in public mode: candidates can only be suggested as new", async () => {
      const user = userEvent.setup();
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(STRUCTURED_EXTRACTION);
      mockEntityReview.reconcileEntities.mockResolvedValueOnce(venueReview(venueItem()));
      renderPage();
      await uploadFlyer(user);
      await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

      expect(await screen.findByRole("heading", { name: REVIEW_HEADING })).toBeInTheDocument();
      const group = within(await venueGroup());
      expect(group.getByRole("button", { name: "Suggest as new venue" })).toBeInTheDocument();
      expect(group.queryByRole("button", { name: "Add as new venue" })).not.toBeInTheDocument();
      expect(screen.getByText(/A moderator confirms anything new/i)).toBeInTheDocument();
    });

    it("keeps the person's decision and edits when the flyer is analysed again", async () => {
      const user = userEvent.setup();
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(STRUCTURED_EXTRACTION);
      mockEntityReview.reconcileEntities.mockResolvedValue(venueReview(venueItem()));
      renderPage();
      await uploadFlyer(user);
      await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

      const choose = within(await venueGroup()).getByRole("button", {
        name: "Use Havana Club & Lounge as the venue",
      });
      await user.click(choose);
      expect(
        within(await venueGroup()).getByRole("button", {
          name: "Using Havana Club & Lounge as the venue",
        })
      ).toHaveAttribute("aria-pressed", "true");
      fireEvent.change(screen.getByLabelText(/Event Title \*/i), {
        target: { value: "My Own Title" },
      });
      fireEvent.change(screen.getByLabelText("Venue Name"), {
        target: { value: "My Own Venue" },
      });

      await user.click(screen.getByRole("button", { name: "Try Again" }));
      await waitFor(() => {
        expect(mockEntityReview.reconcileEntities).toHaveBeenCalledTimes(2);
      });
      expect(await screen.findByText(/Flyer analyzed/i)).toBeInTheDocument();

      const group = within(await venueGroup());
      expect(
        group.getByRole("button", { name: "Using Havana Club & Lounge as the venue" })
      ).toHaveAttribute("aria-pressed", "true");
      expect(group.getByText("Using existing venue: Havana Club & Lounge")).toBeInTheDocument();
      expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("My Own Title");
      expect(screen.getByLabelText("Venue Name")).toHaveValue("My Own Venue");
      expect(mockFlyerExtraction.extractEventFromFlyer).toHaveBeenCalledTimes(2);
    });

    it("does not apply an automatic venue match over a venue the person typed first", async () => {
      const user = userEvent.setup();
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(STRUCTURED_EXTRACTION);
      mockEntityReview.reconcileEntities.mockResolvedValueOnce(
        venueReview(
          venueItem({ state: "MATCHED", decision: "existing", selected_id: EXISTING_VENUE.id })
        )
      );
      renderPage();
      await uploadFlyer(user);
      fireEvent.change(screen.getByLabelText("Venue Name"), { target: { value: "My Own Hall" } });
      await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

      const group = within(await venueGroup());
      expect(
        group.getByText("Undecided. This venue is skipped unless you choose.")
      ).toBeInTheDocument();
      expect(group.queryByText(/^Using existing venue:/)).not.toBeInTheDocument();
      expect(
        group.getByRole("button", { name: "Use Havana Club & Lounge as the venue" })
      ).toHaveAttribute("aria-pressed", "false");
      // The person's text stays; the matched record's address is not pulled in.
      expect(screen.getByLabelText("Venue Name")).toHaveValue("My Own Hall");
      expect(eventAddress()).not.toHaveValue("290 Green Street");
    });

    it("detaches an automatic venue link when the person edits the venue name afterwards", async () => {
      const user = userEvent.setup();
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(STRUCTURED_EXTRACTION);
      mockEntityReview.reconcileEntities.mockResolvedValueOnce(
        venueReview(
          venueItem({ state: "MATCHED", decision: "existing", selected_id: EXISTING_VENUE.id })
        )
      );
      renderPage();
      await uploadFlyer(user);
      await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

      expect(
        within(await venueGroup()).getByText("Using existing venue: Havana Club & Lounge")
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Venue Name")).toHaveValue("Havana Club & Lounge");

      fireEvent.change(screen.getByLabelText("Venue Name"), {
        target: { value: "Somewhere Else" },
      });

      const group = within(await venueGroup());
      expect(
        group.getByText("Undecided. This venue is skipped unless you choose.")
      ).toBeInTheDocument();
      expect(group.queryByText(/^Using existing venue:/)).not.toBeInTheDocument();
      expect(screen.getByLabelText("Venue Name")).toHaveValue("Somewhere Else");
    });

    it("keeps a venue the person chose by clicking, even after they edit the venue name", async () => {
      const user = userEvent.setup();
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(STRUCTURED_EXTRACTION);
      mockEntityReview.reconcileEntities.mockResolvedValueOnce(venueReview(venueItem()));
      renderPage();
      await uploadFlyer(user);
      await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

      await user.click(
        within(await venueGroup()).getByRole("button", {
          name: "Use Havana Club & Lounge as the venue",
        })
      );
      fireEvent.change(screen.getByLabelText("Venue Name"), {
        target: { value: "Somewhere Else" },
      });

      const group = within(await venueGroup());
      expect(group.getByText("Using existing venue: Havana Club & Lounge")).toBeInTheDocument();
      expect(
        group.getByRole("button", { name: "Using Havana Club & Lounge as the venue" })
      ).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByLabelText("Venue Name")).toHaveValue("Somewhere Else");
    });

    it("discards a late reconcile result when the flyer is removed", async () => {
      const user = userEvent.setup();
      const reconcile = Promise.withResolvers<EntityReview>();
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(STRUCTURED_EXTRACTION);
      mockEntityReview.reconcileEntities.mockReturnValueOnce(reconcile.promise);
      renderPage();
      await uploadFlyer(user);
      await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

      expect(
        await screen.findByText(
          "Checking the venue, organizer, instructors and school against existing records…"
        )
      ).toBeInTheDocument();

      // Exact name: the review's own "Remove venue" buttons are different.
      await user.click(screen.getByRole("button", { name: "Remove" }));
      await act(async () => {
        reconcile.resolve(venueReview(venueItem()));
      });

      expect(screen.queryByRole("heading", { name: REVIEW_HEADING })).not.toBeInTheDocument();
      expect(screen.queryByRole("group", { name: /^Venue:/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("");
      expect(screen.getByLabelText("Venue Name")).toHaveValue("");
      expect(
        screen.queryByRole("button", { name: /Extract Event Details/i })
      ).not.toBeInTheDocument();
    });

    it("discards a late reconcile result when the flyer is replaced", async () => {
      const user = userEvent.setup();
      const reconcile = Promise.withResolvers<EntityReview>();
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(STRUCTURED_EXTRACTION);
      mockEntityReview.reconcileEntities.mockReturnValueOnce(reconcile.promise);
      renderPage();
      await uploadFlyer(user);
      await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));
      await screen.findByText(/Checking the venue, organizer, instructors and school/i);

      // Remove-then-upload is the UI path that swaps the flyer (see the
      // flyer-identity test above for why "Replace" is not used).
      await user.click(screen.getByRole("button", { name: "Remove" }));
      await uploadFlyer(user);
      await act(async () => {
        reconcile.resolve(venueReview(venueItem()));
      });

      expect(screen.queryByRole("heading", { name: REVIEW_HEADING })).not.toBeInTheDocument();
      expect(screen.queryByRole("group", { name: /^Venue:/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Event Title \*/i)).toHaveValue("");
      expect(screen.getByLabelText("Venue Name")).toHaveValue("");
      expect(screen.getByRole("button", { name: /Extract Event Details/i })).toBeInTheDocument();
      expect(mockEntityReview.reconcileEntities).toHaveBeenCalledTimes(1);
    });

    it("submits the reviewed entities with the event", async () => {
      const user = userEvent.setup();
      vi.mocked(submissionsRepo.createSubmission).mockResolvedValueOnce("submission-id");
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(STRUCTURED_EXTRACTION);
      mockEntityReview.reconcileEntities.mockResolvedValueOnce(venueReview(venueItem()));
      renderPage();
      await uploadFlyer(user);
      await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));

      await user.click(
        within(await venueGroup()).getByRole("button", { name: "Suggest as new venue" })
      );
      await user.click(screen.getByRole("button", { name: "Submit Event" }));

      await waitFor(() => {
        expect(submissionsRepo.createSubmission).toHaveBeenCalledTimes(1);
      });
      const [submission, extra] = vi.mocked(submissionsRepo.createSubmission).mock.calls[0];
      expect(submission.entity_review).toEqual(
        venueReview(venueItem({ decision: "new", selected_id: null }))
      );
      expect(submission.location).toBe("Havana Club");
      expect(extra).toEqual({ image_url: FLYER_URL });
      expect(await screen.findByText(/Event Submitted!/i)).toBeInTheDocument();
    });

    it("omits entity_review from the submission when the flyer produced no entities", async () => {
      const user = userEvent.setup();
      vi.mocked(submissionsRepo.createSubmission).mockResolvedValueOnce("submission-id");
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(FULL_EXTRACTION);
      renderPage();
      await uploadFlyer(user);
      await user.click(screen.getByRole("button", { name: /Extract Event Details/i }));
      await screen.findByText(/Flyer analyzed/i);
      expect(screen.queryByRole("heading", { name: REVIEW_HEADING })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Submit Event" }));

      await waitFor(() => {
        expect(submissionsRepo.createSubmission).toHaveBeenCalledTimes(1);
      });
      expect(vi.mocked(submissionsRepo.createSubmission).mock.calls[0][0]).not.toHaveProperty(
        "entity_review"
      );
    });
  });
});
