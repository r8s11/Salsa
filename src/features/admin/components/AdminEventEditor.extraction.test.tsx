import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminEventEditor from "./AdminEventEditor";
import { buildEmptyAdminForm, type AdminEventForm } from "../model/adminEventForm";
import {
  emptyEntityReview,
  type EntityCandidate,
  type EntityMatch,
  type EntityReview,
  type EntityReviewItem,
} from "../../entity-matching/entityReview";
import type * as EventFlyersModule from "../../events/api/eventFlyers";
import type { ExtractedEvent } from "../../flyer-extraction/types";

const {
  useActiveTaxonomyTerms,
  useVenueCombobox,
  uploadEventFlyer,
  extractEventFromFlyer,
  reconcileEntities,
  searchEntityMatches,
  fetchAdminEntityDirectory,
} = vi.hoisted(() => ({
  useActiveTaxonomyTerms: vi.fn(),
  useVenueCombobox: vi.fn(),
  uploadEventFlyer: vi.fn(),
  extractEventFromFlyer: vi.fn(),
  reconcileEntities: vi.fn(),
  searchEntityMatches: vi.fn(),
  fetchAdminEntityDirectory: vi.fn(),
}));
vi.mock("../entities/api/entitiesRepo", () => ({ fetchAdminEntityDirectory }));

vi.mock("../hooks/useAdminTaxonomy", () => ({ useActiveTaxonomyTerms }));
vi.mock("../../metros/hooks/useMetros", () => import("../../../test/mockMetros"));
vi.mock("../hooks/useVenueCombobox", () => ({ useVenueCombobox }));
vi.mock("../../events/api/eventFlyers", async (importOriginal) => ({
  ...(await importOriginal<typeof EventFlyersModule>()),
  uploadEventFlyer,
  removeEventFlyer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../flyer-extraction/client", () => ({ extractEventFromFlyer }));
// Nothing in these tests may reach Supabase.
vi.mock("../../entity-matching/entityReviewClient", () => ({
  reconcileEntities,
  searchEntityMatches,
}));

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const FLYER_URL =
  `https://project.supabase.co/storage/v1/object/public/event-flyers/${ADMIN_ID}` +
  `/admin-draft-33333333-3333-4333-8333-333333333333/flyer.png`;

const STUDIO_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORGANIZER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const STUDIO_MATCH: EntityMatch = {
  id: STUDIO_ID,
  name: "Studio 5",
  address: "5 Main St",
  city: "Boston",
  state_region: "MA",
  website: "studio5.example",
  instagram: "@studio5",
};
const ORGANIZER_MATCH: EntityMatch = {
  id: ORGANIZER_ID,
  name: "Casa Latina Productions",
  city: "Boston",
};

const VENUE: EntityCandidate = { name: "studio five", address: "5 Main Street", city: "Boston" };
// Organizers and instructors need a website or Instagram, schools an address,
// website or Instagram, before an admin can add them as new records.
const ORGANIZER: EntityCandidate = { name: "Casa Latina", instagram: "@casalatina" };
const INSTRUCTOR: EntityCandidate = { name: "Ana Rivera", instagram: "@anarivera" };
const SCHOOL: EntityCandidate = { name: "Salsa Lab", website: "https://salsalab.example" };

function extraction(overrides: Partial<ExtractedEvent> = {}): ExtractedEvent {
  return {
    title: "Salsa Rooftop",
    date: "2026-10-01",
    start_time: "21:00",
    end_time: null,
    venue_name: "The Terrace",
    address: "5 Main St",
    city: "boston",
    dance_styles: [],
    event_type: null,
    price: null,
    organizer_name: null,
    instagram: null,
    website: null,
    details: [],
    ...overrides,
  };
}

/** A flyer that names a venue, an organizer, one instructor and a school. */
function flyerWithEntities(overrides: Partial<ExtractedEvent> = {}): ExtractedEvent {
  return extraction({
    venue_name: "studio five",
    address: "5 Main Street",
    venue: VENUE,
    organizer: ORGANIZER,
    instructors: [INSTRUCTOR],
    school: SCHOOL,
    ...overrides,
  });
}

function reviewItem(
  candidate: EntityCandidate,
  overrides: Partial<EntityReviewItem> = {}
): EntityReviewItem {
  return {
    candidate,
    state: "NEW",
    matches: [],
    decision: "pending",
    selected_id: null,
    ...overrides,
  };
}

/** What reconciliation returns for `flyerWithEntities`: the venue is a possible match. */
function reconciledReview(overrides: Partial<EntityReview> = {}): EntityReview {
  return {
    venue: reviewItem(VENUE, { state: "POSSIBLE MATCH", matches: [STUDIO_MATCH] }),
    organizer: reviewItem(ORGANIZER),
    instructors: [reviewItem(INSTRUCTOR)],
    school: reviewItem(SCHOOL),
    ...overrides,
  };
}

function renderCreateEditor(flyerOwnerId: string | null = ADMIN_ID) {
  const onSubmit = vi
    .fn<(form: AdminEventForm, flyer: File | null) => Promise<void>>()
    .mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <AdminEventEditor
        initial={buildEmptyAdminForm("boston")}
        initialTaxonomyTerms={[]}
        heading="New event"
        submitLabel="Create event"
        isSaving={false}
        error={null}
        flyerOwnerId={flyerOwnerId}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    </MemoryRouter>
  );
  return { onSubmit };
}

function flyerFile() {
  return new File(["flyer-bytes"], "flyer.png", { type: "image/png" });
}

const analyzeButton = () => screen.getByRole("button", { name: /Analyze flyer/i });

async function uploadFlyer(user: UserEvent) {
  await user.upload(screen.getByLabelText("Event flyer"), flyerFile());
  return waitFor(() => expect(analyzeButton()).toBeEnabled());
}

async function analyzeFlyer(user: UserEvent) {
  await uploadFlyer(user);
  await user.click(analyzeButton());
  await screen.findByText(/Flyer analyzed/i);
}

/** Replaces the uploaded flyer and waits until the new upload has settled. */
async function replaceFlyer(user: UserEvent) {
  const uploads = uploadEventFlyer.mock.calls.length;
  await user.upload(screen.getByLabelText("Event flyer"), flyerFile());
  await waitFor(() => expect(uploadEventFlyer).toHaveBeenCalledTimes(uploads + 1));
  await waitFor(() => expect(analyzeButton()).toBeEnabled());
}

const group = (name: string | RegExp) => screen.getByRole("group", { name });
const queryGroup = (name: string | RegExp) => screen.queryByRole("group", { name });
const field = (id: string) => document.getElementById(id) as HTMLInputElement;

const CHECKING_BANNER =
  "Checking the venue, organizer, instructors and school against existing records…";
const FALLBACK_BANNER = "We couldn't check these against existing records. Review them below.";

beforeEach(() => {
  vi.clearAllMocks();
  fetchAdminEntityDirectory.mockReset().mockResolvedValue([
    { id: "series-1", kind: "series", name: "Boston Salsa Sundays", slug: "boston-salsa-sundays", status: "active" },
  ]);
  useActiveTaxonomyTerms.mockReturnValue({ terms: [] });
  useVenueCombobox.mockReturnValue({
    selectedId: null,
    selectedName: "",
    selectedAddress: "",
    results: [],
    query: "",
    isOpen: false,
    clearVenue: vi.fn(),
    selectVenue: vi.fn(),
    setQuery: vi.fn(),
    setIsOpen: vi.fn(),
  });
  uploadEventFlyer.mockResolvedValue({ path: "p", url: FLYER_URL });
  extractEventFromFlyer.mockResolvedValue(extraction());
  reconcileEntities.mockReset().mockResolvedValue(emptyEntityReview());
  searchEntityMatches.mockReset().mockResolvedValue([]);
});

describe("Admin direct-create flyer analysis", () => {
  it("uploads the flyer under the admin's own id so analysis can read it", async () => {
    const user = userEvent.setup();
    renderCreateEditor();

    await uploadFlyer(user);

    expect(uploadEventFlyer).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: ADMIN_ID,
        eventId: expect.stringMatching(/^admin-draft-/),
      })
    );
  });

  it("analyzes the uploaded flyer and applies the extracted details on request", async () => {
    const user = userEvent.setup();
    renderCreateEditor();
    await uploadFlyer(user);

    await user.click(screen.getByRole("button", { name: /Analyze flyer/i }));

    expect(extractEventFromFlyer).toHaveBeenCalledWith(FLYER_URL);
    expect(await screen.findByText(/Flyer analyzed/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use These Details" }));

    expect(screen.getByLabelText(/Event Title/i)).toHaveValue("Salsa Rooftop");
    expect(screen.getByLabelText("Date *")).toHaveValue("2026-10-01");
  });

  it("keeps the applied fields editable by hand", async () => {
    const user = userEvent.setup();
    renderCreateEditor();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Analyze flyer/i }));
    await screen.findByText(/Flyer analyzed/i);
    await user.click(screen.getByRole("button", { name: "Use These Details" }));

    const title = screen.getByLabelText(/Event Title/i);
    await user.clear(title);
    await user.type(title, "Corrected Title");

    expect(title).toHaveValue("Corrected Title");
  });

  it("shows a readable failure with retry instead of appearing to do nothing", async () => {
    const user = userEvent.setup();
    extractEventFromFlyer.mockRejectedValueOnce(new Error("We couldn't read this flyer."));
    renderCreateEditor();
    await uploadFlyer(user);

    await user.click(screen.getByRole("button", { name: /Analyze flyer/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't read this flyer.");

    await user.click(screen.getByRole("button", { name: "Try Again" }));

    expect(await screen.findByText(/Flyer analyzed/i)).toBeInTheDocument();
    expect(extractEventFromFlyer).toHaveBeenCalledTimes(2);
  });

  it("refuses to upload to an unanalyzable path when the admin id is unresolved", async () => {
    const user = userEvent.setup();
    renderCreateEditor(null);

    await user.upload(screen.getByLabelText("Event flyer"), flyerFile());

    expect(uploadEventFlyer).not.toHaveBeenCalled();
    expect(await screen.findByText(/admin session is still loading/i)).toBeInTheDocument();
  });
});

describe("Admin flyer entity review", () => {
  it("reconciles the extracted entities and shows all four groups for review", async () => {
    const user = userEvent.setup();
    extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
    reconcileEntities.mockResolvedValue(reconciledReview());
    renderCreateEditor();

    await analyzeFlyer(user);

    expect(reconcileEntities).toHaveBeenCalledTimes(1);
    expect(reconcileEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        venue: expect.objectContaining({ name: "studio five", address: "5 Main Street" }),
        organizer: expect.objectContaining({ name: "Casa Latina" }),
        instructors: [expect.objectContaining({ name: "Ana Rivera" })],
        school: expect.objectContaining({ name: "Salsa Lab" }),
      })
    );
    for (const heading of ["Venue", "Organizer", "Instructors", "School"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }

    const venue = group("Venue: studio five");
    expect(within(venue).getByText("Possible match")).toBeInTheDocument();
    expect(
      within(venue).getByText("5 Main St · Boston, MA · studio5.example · @studio5")
    ).toBeInTheDocument();
    expect(
      within(venue).getByRole("button", { name: "Use Studio 5 as the venue" })
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(group("Organizer: Casa Latina")).getByText("Not in our records")
    ).toBeInTheDocument();
    expect(
      within(group("Instructor: Ana Rivera")).getByText("Not in our records")
    ).toBeInTheDocument();
    expect(within(group("School: Salsa Lab")).getByText("Not in our records")).toBeInTheDocument();
    expect(screen.queryByText(CHECKING_BANNER)).not.toBeInTheDocument();
    expect(screen.queryByText(FALLBACK_BANNER)).not.toBeInTheDocument();
  });

  it("keeps the review section available when a flyer yields nothing to reconcile", async () => {
    const user = userEvent.setup();
    extractEventFromFlyer.mockResolvedValue(
      extraction({
        venue_name: null,
        address: null,
        venue: null,
        organizer: null,
        instructors: [],
        school: null,
      })
    );
    renderCreateEditor();

    await analyzeFlyer(user);

    expect(reconcileEntities).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Venue, organizer, instructors and school" })).toBeInTheDocument();
    expect(screen.getByLabelText("Add venue by name")).toBeInTheDocument();
    expect(queryGroup(/^Venue:/)).not.toBeInTheDocument();
  });

  it("announces the check while reconciliation is in flight", async () => {
    const user = userEvent.setup();
    const pending = Promise.withResolvers<EntityReview>();
    extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
    reconcileEntities.mockReturnValueOnce(pending.promise);
    renderCreateEditor();
    await uploadFlyer(user);

    await user.click(analyzeButton());

    expect(await screen.findByText(CHECKING_BANNER)).toBeInTheDocument();
    expect(queryGroup(/^Venue:/)).not.toBeInTheDocument();

    await act(async () => {
      pending.resolve(reconciledReview());
    });

    expect(await screen.findByText(/Flyer analyzed/i)).toBeInTheDocument();
    expect(screen.queryByText(CHECKING_BANNER)).not.toBeInTheDocument();
    expect(group("Venue: studio five")).toBeInTheDocument();
  });

  describe("Use These Details", () => {
    it("fills location and address from the venue the admin explicitly chose", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockResolvedValue(reconciledReview());
      renderCreateEditor();
      await analyzeFlyer(user);

      await user.click(
        within(group("Venue: studio five")).getByRole("button", {
          name: "Use Studio 5 as the venue",
        })
      );
      await user.click(screen.getByRole("button", { name: "Use These Details" }));

      expect(field("event-location")).toHaveValue("Studio 5");
      expect(field("event-address")).toHaveValue("5 Main St");
      expect(screen.getByLabelText(/Event Title/i)).toHaveValue("Salsa Rooftop");
      // The decision survives applying the details.
      expect(
        within(group("Venue: studio five")).getByRole("button", {
          name: "Using Studio 5 as the venue",
        })
      ).toHaveAttribute("aria-pressed", "true");
    });

    it("keeps the flyer's raw venue text while the match is still undecided", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockResolvedValue(reconciledReview());
      renderCreateEditor();
      await analyzeFlyer(user);

      await user.click(screen.getByRole("button", { name: "Use These Details" }));

      expect(field("event-location")).toHaveValue("studio five");
      expect(field("event-address")).toHaveValue("5 Main Street");
    });

    it("keeps the flyer's raw venue text when the admin confirms the venue as new", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockResolvedValue(reconciledReview());
      renderCreateEditor();
      await analyzeFlyer(user);

      await user.click(
        within(group("Venue: studio five")).getByRole("button", { name: "Add as new venue" })
      );
      await user.click(screen.getByRole("button", { name: "Use These Details" }));

      expect(field("event-location")).toHaveValue("studio five");
      expect(field("event-address")).toHaveValue("5 Main Street");
    });
  });

  it("hands the reviewed entities and the admin's decisions to onSubmit", async () => {
    const user = userEvent.setup();
    extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
    reconcileEntities.mockResolvedValue(reconciledReview());
    const { onSubmit } = renderCreateEditor();
    await analyzeFlyer(user);

    await user.click(
      within(group("Venue: studio five")).getByRole("button", {
        name: "Use Studio 5 as the venue",
      })
    );
    await user.click(
      within(group("Organizer: Casa Latina")).getByRole("button", {
        name: "Add as new organizer",
      })
    );
    await user.click(screen.getByRole("button", { name: "Use These Details" }));
    await user.click(
      within(screen.getByRole("group", { name: /^Event type/ })).getByRole("button", {
        name: "Social",
      })
    );
    await user.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [form, flyer] = onSubmit.mock.calls[0];
    expect(flyer).toBeNull();
    expect(form.location).toBe("Studio 5");
    expect(form.image_url).toBe(FLYER_URL);
    // toMatchObject: the section may tag a chosen item with bookkeeping flags.
    expect(form.entity_review).toMatchObject({
      venue: {
        candidate: VENUE,
        state: "POSSIBLE MATCH",
        matches: [STUDIO_MATCH],
        decision: "existing",
        selected_id: STUDIO_ID,
      },
      organizer: {
        candidate: ORGANIZER,
        state: "NEW",
        matches: [],
        decision: "new",
        selected_id: null,
      },
      instructors: [
        {
          candidate: INSTRUCTOR,
          state: "NEW",
          matches: [],
          decision: "pending",
          selected_id: null,
        },
      ],
      school: {
        candidate: SCHOOL,
        state: "NEW",
        matches: [],
        decision: "pending",
        selected_id: null,
      },
    });
  });

  it("does not submit an entity review when the flyer produced none", async () => {
    const user = userEvent.setup();
    extractEventFromFlyer.mockResolvedValue(extraction());
    const { onSubmit } = renderCreateEditor();
    await analyzeFlyer(user);
    await user.click(screen.getByRole("button", { name: "Use These Details" }));
    await user.click(
      within(screen.getByRole("group", { name: /^Event type/ })).getByRole("button", {
        name: "Social",
      })
    );

    await user.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].entity_review).toBeUndefined();
  });

  describe("retrying the analysis", () => {
    it("keeps decided and edited candidates and never re-adds the original", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities
        .mockResolvedValueOnce(reconciledReview())
        .mockResolvedValueOnce(
          // The retry reconciles the original, untouched candidates again — and
          // now finds the organizer in the records.
          reconciledReview({
            organizer: reviewItem(ORGANIZER, {
              state: "MATCHED",
              matches: [ORGANIZER_MATCH],
              decision: "existing",
              selected_id: ORGANIZER_ID,
            }),
          })
        );
      const { onSubmit } = renderCreateEditor();
      await analyzeFlyer(user);

      // Decide the venue and edit the instructor's name.
      await user.click(
        within(group("Venue: studio five")).getByRole("button", {
          name: "Use Studio 5 as the venue",
        })
      );
      await user.type(within(group("Instructor: Ana Rivera")).getByLabelText("Name"), " Jr");
      expect(group("Instructor: Ana Rivera Jr")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Try Again" }));
      await waitFor(() => expect(reconcileEntities).toHaveBeenCalledTimes(2));
      await screen.findByText(/Flyer analyzed/i);

      // The decided venue is untouched by the fresh, undecided reconciliation.
      expect(
        within(group("Venue: studio five")).getByRole("button", {
          name: "Using Studio 5 as the venue",
        })
      ).toHaveAttribute("aria-pressed", "true");
      // The edited instructor stays, and the original is not added back.
      expect(screen.getAllByRole("group", { name: /^Instructor:/ })).toHaveLength(1);
      expect(group("Instructor: Ana Rivera Jr")).toBeInTheDocument();
      expect(queryGroup("Instructor: Ana Rivera")).not.toBeInTheDocument();
      // An untouched candidate takes the fresh reconciliation.
      expect(within(group("Organizer: Casa Latina")).getByText("Matched")).toBeInTheDocument();
      expect(
        within(group("Organizer: Casa Latina")).getByText(
          "Using existing organizer: Casa Latina Productions"
        )
      ).toBeInTheDocument();

      // What gets saved reflects the same merge.
      await user.click(screen.getByRole("button", { name: "Use These Details" }));
      await user.click(
        within(screen.getByRole("group", { name: /^Event type/ })).getByRole("button", {
          name: "Social",
        })
      );
      await user.click(screen.getByRole("button", { name: "Create event" }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      const review = onSubmit.mock.calls[0][0].entity_review;
      expect(review?.venue).toMatchObject({ decision: "existing", selected_id: STUDIO_ID });
      expect(review?.instructors).toHaveLength(1);
      expect(review?.instructors[0].candidate.name).toBe("Ana Rivera Jr");
      expect(review?.organizer).toMatchObject({ decision: "existing", selected_id: ORGANIZER_ID });
    });
  });

  describe("when the flyer changes during analysis", () => {
    it("discards a late extraction when the flyer is replaced", async () => {
      const user = userEvent.setup();
      const pending = Promise.withResolvers<ExtractedEvent>();
      extractEventFromFlyer.mockReturnValueOnce(pending.promise);
      reconcileEntities.mockResolvedValue(reconciledReview());
      renderCreateEditor();
      await uploadFlyer(user);
      await user.click(analyzeButton());
      expect(await screen.findByText("Analyzing your flyer…")).toBeInTheDocument();

      await replaceFlyer(user);
      await act(async () => {
        pending.resolve(flyerWithEntities());
      });

      expect(extractEventFromFlyer).toHaveBeenCalledTimes(1);
      expect(reconcileEntities).not.toHaveBeenCalled();
      expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument();
      expect(screen.queryByText("Analyzing your flyer…")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Venue, organizer, instructors and school" })).toBeInTheDocument();
      expect(queryGroup(/^Venue:/)).not.toBeInTheDocument();
      // Idle again: the new flyer can be analyzed.
      expect(analyzeButton()).toBeEnabled();
    });

    it("discards a late extraction when the flyer is removed", async () => {
      const user = userEvent.setup();
      const pending = Promise.withResolvers<ExtractedEvent>();
      extractEventFromFlyer.mockReturnValueOnce(pending.promise);
      reconcileEntities.mockResolvedValue(reconciledReview());
      renderCreateEditor();
      await uploadFlyer(user);
      await user.click(analyzeButton());
      expect(await screen.findByText("Analyzing your flyer…")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Remove" }));
      await act(async () => {
        pending.resolve(flyerWithEntities());
      });

      expect(reconcileEntities).not.toHaveBeenCalled();
      expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument();
      expect(screen.queryByText("Analyzing your flyer…")).not.toBeInTheDocument();
      expect(queryGroup(/^Venue:/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Analyze flyer/i })).not.toBeInTheDocument();
    });

    it("discards a late reconciliation when the flyer is replaced", async () => {
      const user = userEvent.setup();
      const pending = Promise.withResolvers<EntityReview>();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockReturnValueOnce(pending.promise);
      renderCreateEditor();
      await uploadFlyer(user);
      await user.click(analyzeButton());
      expect(await screen.findByText(CHECKING_BANNER)).toBeInTheDocument();

      await replaceFlyer(user);
      expect(screen.queryByText(CHECKING_BANNER)).not.toBeInTheDocument();
      await act(async () => {
        pending.resolve(reconciledReview());
      });

      expect(reconcileEntities).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument();
      expect(screen.queryByText(CHECKING_BANNER)).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Venue, organizer, instructors and school" })).toBeInTheDocument();
      expect(queryGroup(/^Venue:/)).not.toBeInTheDocument();
      expect(analyzeButton()).toBeEnabled();
    });

    it("discards a late failed reconciliation when the flyer is removed", async () => {
      const user = userEvent.setup();
      const pending = Promise.withResolvers<EntityReview>();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockReturnValueOnce(pending.promise);
      renderCreateEditor();
      await uploadFlyer(user);
      await user.click(analyzeButton());
      expect(await screen.findByText(CHECKING_BANNER)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Remove" }));
      await act(async () => {
        pending.reject(new Error("rpc down"));
      });

      // No fallback review and no failure banner for a flyer that is gone.
      expect(screen.queryByText(FALLBACK_BANNER)).not.toBeInTheDocument();
      expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument();
      expect(queryGroup(/^Venue:/)).not.toBeInTheDocument();
    });
  });

  describe("when the flyer is removed after analysis", () => {
    it("clears a review the admin never touched", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockResolvedValue(reconciledReview());
      renderCreateEditor();
      await analyzeFlyer(user);
      expect(group("Venue: studio five")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Remove" }));

      expect(screen.getByRole("heading", { name: "Venue, organizer, instructors and school" })).toBeInTheDocument();
      expect(queryGroup(/^Venue:/)).not.toBeInTheDocument();
      expect(queryGroup(/^Organizer:/)).not.toBeInTheDocument();
      expect(queryGroup(/^Instructor:/)).not.toBeInTheDocument();
      expect(queryGroup(/^School:/)).not.toBeInTheDocument();
      expect(screen.getByText("No venue was found on the flyer.")).toBeInTheDocument();
      expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument();
    });

    it("keeps what the admin decided and drops the rest", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockResolvedValue(reconciledReview());
      const { onSubmit } = renderCreateEditor();
      await analyzeFlyer(user);
      await user.click(
        within(group("Venue: studio five")).getByRole("button", {
          name: "Use Studio 5 as the venue",
        })
      );

      await user.click(screen.getByRole("button", { name: "Remove" }));

      await waitFor(() => expect(screen.queryByText(/Flyer analyzed/i)).not.toBeInTheDocument());
      expect(
        within(group("Venue: studio five")).getByRole("button", {
          name: "Using Studio 5 as the venue",
        })
      ).toHaveAttribute("aria-pressed", "true");
      expect(queryGroup(/^Organizer:/)).not.toBeInTheDocument();
      expect(queryGroup(/^Instructor:/)).not.toBeInTheDocument();
      expect(queryGroup(/^School:/)).not.toBeInTheDocument();
      expect(screen.getByText("No organizer was found on the flyer.")).toBeInTheDocument();

      // The kept decision is what a save would send.
      await user.type(screen.getByLabelText(/Event Title/i), "Manual Title");
      fireEvent.change(screen.getByLabelText("Date *"), { target: { value: "2026-10-02" } });
      await user.click(
        within(screen.getByRole("group", { name: /^Event type/ })).getByRole("button", {
          name: "Social",
        })
      );
      await user.click(screen.getByRole("button", { name: "Create event" }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      const review = onSubmit.mock.calls[0][0].entity_review;
      expect(review?.venue).toMatchObject({ decision: "existing", selected_id: STUDIO_ID });
      expect(review?.organizer).toBeNull();
      expect(review?.instructors).toEqual([]);
      expect(review?.school).toBeNull();
    });
  });

  describe("when reconciliation fails", () => {
    it("falls back to unresolved candidates and says so", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockRejectedValue(new Error("rpc down"));
      renderCreateEditor();

      await analyzeFlyer(user);

      expect(await screen.findByText(FALLBACK_BANNER)).toBeInTheDocument();
      const venue = group("Venue: studio five");
      expect(within(venue).getByText("Needs review")).toBeInTheDocument();
      expect(
        within(venue).getByText("Undecided. This venue is skipped unless you choose.")
      ).toBeInTheDocument();
      expect(within(venue).getByRole("button", { name: "Check for matches" })).toBeEnabled();
      expect(within(venue).queryByRole("button", { name: /^Use .* as the venue$/ })).toBeNull();
      for (const name of [
        "Organizer: Casa Latina",
        "Instructor: Ana Rivera",
        "School: Salsa Lab",
      ]) {
        expect(within(group(name)).getByText("Needs review")).toBeInTheDocument();
      }

      // Unresolved candidates never rewrite the form.
      await user.click(screen.getByRole("button", { name: "Use These Details" }));
      expect(field("event-location")).toHaveValue("studio five");
      expect(field("event-address")).toHaveValue("5 Main Street");
    });

    it("lets the admin re-check a fallback candidate once the service is back", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities
        .mockRejectedValueOnce(new Error("rpc down"))
        .mockResolvedValueOnce(reconciledReview());
      renderCreateEditor();
      await analyzeFlyer(user);
      const venue = group("Venue: studio five");
      expect(within(venue).getByText("Needs review")).toBeInTheDocument();

      await user.click(within(venue).getByRole("button", { name: "Check for matches" }));

      await waitFor(() =>
        expect(within(group("Venue: studio five")).getByText("Possible match")).toBeInTheDocument()
      );
      expect(reconcileEntities).toHaveBeenCalledTimes(2);
      expect(reconcileEntities).toHaveBeenLastCalledWith({
        venue: expect.objectContaining({ name: "studio five" }),
        organizer: null,
        instructors: [],
        school: null,
      });
      expect(
        within(group("Venue: studio five")).getByRole("button", {
          name: "Use Studio 5 as the venue",
        })
      ).toBeInTheDocument();
    });
  });

  describe("automatic venue links", () => {
    /** The matcher settled on Studio 5 by itself: "existing", but never clicked. */
    const autoLinkedReview = () =>
      reconciledReview({
        venue: reviewItem(VENUE, {
          state: "MATCHED",
          matches: [STUDIO_MATCH],
          decision: "existing",
          selected_id: STUDIO_ID,
        }),
      });
    const venueSummary = (text: string) =>
      within(group("Venue: studio five")).getByText(text);

    it("keeps an automatic link on an empty form", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockResolvedValue(autoLinkedReview());
      renderCreateEditor();

      await analyzeFlyer(user);

      expect(venueSummary("Using existing venue: Studio 5")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Use These Details" }));
      expect(field("event-location")).toHaveValue("Studio 5");
      expect(field("event-address")).toHaveValue("5 Main St");
    });

    it("leaves an automatic link undecided when the form already names a different venue", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockResolvedValue(autoLinkedReview());
      renderCreateEditor();
      await user.type(field("event-location"), "Some Other Hall");

      await analyzeFlyer(user);

      expect(
        venueSummary("Undecided. This venue is skipped unless you choose.")
      ).toBeInTheDocument();
      expect(
        within(group("Venue: studio five")).getByRole("button", {
          name: "Use Studio 5 as the venue",
        })
      ).toHaveAttribute("aria-pressed", "false");
      // The admin's own venue text is never replaced.
      await user.click(screen.getByRole("button", { name: "Use These Details" }));
      expect(field("event-location")).toHaveValue("Some Other Hall");
    });

    it("keeps an automatic link when the form already names the same venue", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockResolvedValue(autoLinkedReview());
      renderCreateEditor();
      await user.type(field("event-location"), "Studio 5");

      await analyzeFlyer(user);

      expect(venueSummary("Using existing venue: Studio 5")).toBeInTheDocument();
    });

    it("detaches an automatic link when the admin edits the event's venue text", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockResolvedValue(autoLinkedReview());
      renderCreateEditor();
      await analyzeFlyer(user);
      expect(venueSummary("Using existing venue: Studio 5")).toBeInTheDocument();

      await user.type(field("event-address"), "9 Elm St");

      expect(
        venueSummary("Undecided. This venue is skipped unless you choose.")
      ).toBeInTheDocument();
      expect(
        within(group("Venue: studio five")).getByRole("button", {
          name: "Use Studio 5 as the venue",
        })
      ).toHaveAttribute("aria-pressed", "false");
    });

    it("keeps a link the admin clicked when they edit the event's venue text", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities());
      reconcileEntities.mockResolvedValue(reconciledReview());
      const { onSubmit } = renderCreateEditor();
      await analyzeFlyer(user);
      await user.click(
        within(group("Venue: studio five")).getByRole("button", {
          name: "Use Studio 5 as the venue",
        })
      );

      fireEvent.change(field("event-address"), { target: { value: "9 Elm St" } });
      fireEvent.change(field("event-location"), { target: { value: "Studio Annex" } });

      expect(venueSummary("Using existing venue: Studio 5")).toBeInTheDocument();
      expect(
        within(group("Venue: studio five")).getByRole("button", {
          name: "Using Studio 5 as the venue",
        })
      ).toHaveAttribute("aria-pressed", "true");

      fireEvent.change(screen.getByLabelText(/Event Title/i), { target: { value: "Manual Title" } });
      fireEvent.change(screen.getByLabelText("Date *"), { target: { value: "2026-10-02" } });
      await user.click(
        within(screen.getByRole("group", { name: /^Event type/ })).getByRole("button", {
          name: "Social",
        })
      );
      await user.click(screen.getByRole("button", { name: "Create event" }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0].entity_review?.venue).toMatchObject({
        decision: "existing",
        selected_id: STUDIO_ID,
        explicit: true,
      });
    });
  });

  describe("adding a new record", () => {
    it("requires a creation signal before an organizer can be added as new", async () => {
      const user = userEvent.setup();
      const bareOrganizer: EntityCandidate = { name: "Casa Latina" };
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities({ organizer: bareOrganizer }));
      reconcileEntities.mockResolvedValue(
        reconciledReview({ organizer: reviewItem(bareOrganizer) })
      );
      renderCreateEditor();
      await analyzeFlyer(user);
      const organizer = group("Organizer: Casa Latina");

      const add = within(organizer).getByRole("button", { name: "Add as new organizer" });
      expect(add).toBeDisabled();
      expect(
        within(organizer).getByText(
          /To add a new organizer, include a website or Instagram under Edit organizer details\./
        )
      ).toBeInTheDocument();
      // A venue with an address already has a signal.
      expect(
        within(group("Venue: studio five")).getByRole("button", { name: "Add as new venue" })
      ).toBeEnabled();

      await user.type(within(organizer).getByLabelText("Website"), "casalatina.example");

      expect(within(organizer).getByRole("button", { name: "Add as new organizer" })).toBeEnabled();
      expect(within(organizer).queryByText(/To add a new organizer, include/)).toBeNull();
      await user.click(within(organizer).getByRole("button", { name: "Add as new organizer" }));
      expect(
        within(organizer).getByRole("button", { name: "Adding as new organizer" })
      ).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("event city", () => {
    it("does not overwrite a city the admin chose, from the flyer or a chosen venue", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(flyerWithEntities({ city: "Miami" }));
      reconcileEntities.mockResolvedValue(reconciledReview());
      renderCreateEditor();
      await uploadFlyer(user);
      await user.selectOptions(screen.getByLabelText("City *"), "new-york-city");
      await user.click(analyzeButton());
      await screen.findByText(/Flyer analyzed/i);
      await user.click(
        within(group("Venue: studio five")).getByRole("button", {
          name: "Use Studio 5 as the venue",
        })
      );

      await user.click(screen.getByRole("button", { name: "Use These Details" }));

      expect(screen.getByLabelText("City *")).toHaveValue("new-york-city");
      const feedback = await screen.findByText(/from your flyer/i);
      expect(feedback.textContent).not.toMatch(/city/i);
      // Everything else is still filled, including the chosen venue.
      expect(field("event-location")).toHaveValue("Studio 5");
      expect(screen.getByLabelText(/Event Title/i)).toHaveValue("Salsa Rooftop");
    });

    it("replaces the untouched default city with the flyer's city", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer.mockResolvedValue(extraction({ city: "Miami" }));
      renderCreateEditor();
      await analyzeFlyer(user);
      expect(screen.getByLabelText("City *")).toHaveValue("boston");

      await user.click(screen.getByRole("button", { name: "Use These Details" }));

      expect(screen.getByLabelText("City *")).toHaveValue("miami");
      expect((await screen.findByText(/from your flyer/i)).textContent).toMatch(/city/i);
    });

    it("keeps a city chosen after a first extraction when a retry reads a different one", async () => {
      const user = userEvent.setup();
      extractEventFromFlyer
        .mockResolvedValueOnce(extraction({ city: "boston" }))
        .mockResolvedValueOnce(extraction({ city: "Miami" }));
      renderCreateEditor();
      await analyzeFlyer(user);
      await user.selectOptions(screen.getByLabelText("City *"), "new-york-city");

      await user.click(screen.getByRole("button", { name: "Try Again" }));
      await waitFor(() => expect(extractEventFromFlyer).toHaveBeenCalledTimes(2));
      await screen.findByText(/Flyer analyzed/i);
      await user.click(screen.getByRole("button", { name: "Use These Details" }));

      expect(screen.getByLabelText("City *")).toHaveValue("new-york-city");
    });
  });
});
  it("keeps linked entity review visible and intact while editing without a flyer", async () => {
    const user = userEvent.setup();
    const linkedReview: EntityReview = {
      venue: null,
      organizer: reviewItem(
        { name: "Casa Latina" },
        {
          state: "MATCHED",
          matches: [ORGANIZER_MATCH],
          decision: "existing",
          selected_id: ORGANIZER_ID,
        }
      ),
      instructors: [],
      school: null,
    };
    const onSubmit = vi
      .fn<(form: AdminEventForm, flyer: File | null) => Promise<void>>()
      .mockResolvedValue(undefined);
    const initial: AdminEventForm = {
      ...buildEmptyAdminForm("boston"),
      title: "Existing event",
      event_type: "social",
      event_date: "2026-10-04",
      entity_review: linkedReview,
    };
    render(
      <MemoryRouter>
        <AdminEventEditor
          initial={initial}
          initialTaxonomyTerms={[]}
          heading="Edit event"
          submitLabel="Save event"
          isSaving={false}
          error={null}
          eventId="event-1"
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Venue, organizer, instructors and school")).toBeInTheDocument();
    expect(screen.getByText("Using existing organizer: Casa Latina Productions")).toBeInTheDocument();
    expect(screen.getByLabelText(/Event Title/i)).toHaveValue("Existing event");
    await user.clear(screen.getByLabelText(/Event Title/i));
    await user.type(screen.getByLabelText(/Event Title/i), "Edited event");
    await user.click(screen.getByRole("button", { name: "Save event" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].entity_review?.organizer).toMatchObject({
      decision: "existing",
      selected_id: ORGANIZER_ID,
    });
  });
  it("selects a Series by its name and includes its ID when saving", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn<(form: AdminEventForm, flyer: File | null) => Promise<void>>()
      .mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <AdminEventEditor
          initial={{
            ...buildEmptyAdminForm("boston"),
            title: "Salsa Sunday",
            event_type: "social",
            event_date: "2026-10-04",
          }}
          initialTaxonomyTerms={[]}
          heading="New event"
          submitLabel="Create event"
          isSaving={false}
          error={null}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("option", { name: "Boston Salsa Sundays" })
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Series"), "series-1");
    expect(screen.getByLabelText("Add venue by name")).toBeInTheDocument();
    expect(screen.getByLabelText("Add organizer by name")).toBeInTheDocument();
    expect(screen.getByLabelText("Add instructor by name")).toBeInTheDocument();
    expect(screen.getByLabelText("Add school by name")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create event" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].series_id).toBe("series-1");
  });
