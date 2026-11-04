import "temporal-polyfill/global";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { DatabaseEvent } from "../../../types/events";
import type { Itinerary, ItineraryDraft } from "../../itineraries/model/types";
import { itineraryWarnings } from "../../itineraries/model/schedule";
import { defaultWeekStart } from "../../itineraries/model/week";
import AdminItineraryEditorPage from "./AdminItineraryEditorPage";
import AdminItineraryPreviewPage from "./AdminItineraryPreviewPage";

const queries = vi.hoisted(() => ({ useItineraryDraft: vi.fn(), useWeekEvents: vi.fn() }));
const repo = vi.hoisted(() => ({ saveItinerary: vi.fn(), setItineraryStatus: vi.fn() }));
const events = vi.hoisted(() => ({ fetchApprovedEventsByIds: vi.fn() }));
const publisher = vi.hoisted(() => ({
  publish: vi.fn(),
  refreshCard: vi.fn(),
  loadItineraryPoster: vi.fn(),
  sharePosterFile: vi.fn(),
}));
const poster = vi.hoisted(() => ({ capturePosterElement: vi.fn(), downloadBlob: vi.fn() }));

vi.mock("../../itineraries/hooks/useItineraryQueries", () => ({
  ADMIN_ITINERARIES_KEY: ["admin", "itineraries"],
  adminItineraryKey: (id: string) => ["admin", "itineraries", id],
  ...queries,
}));
vi.mock("../../itineraries/api/itinerariesRepo", async (importOriginal) => ({
  ...(await importOriginal()),
  ...repo,
}));
vi.mock("../../events/api/eventsRepo", () => events);
vi.mock("../../itineraries/hooks/usePublishItinerary", async (importOriginal) => ({
  ...(await importOriginal()),
  loadItineraryPoster: publisher.loadItineraryPoster,
  usePublishItinerary: () => ({ ...publisher, status: "idle", error: null }),
}));
vi.mock("../../calendar/hooks/useShareablePoster", () => ({ useShareablePoster: () => poster }));
vi.mock("../../events/model/sharePosterFile", () => ({ sharePosterFile: publisher.sharePosterFile }));
vi.mock("../../metros/hooks/useMetros", () => ({
  useMetros: () => ({
    metros: [
      { slug: "boston", name: "Boston" },
      { slug: "san-francisco", name: "San Francisco" },
    ],
    loading: false,
    error: null,
  }),
  useActiveMetros: () => ({ activeMetros: [], loading: false, error: null }),
  useMetroName: () => (slug: string) => (slug === "boston" ? "Boston" : slug),
}));
vi.mock("../../../contexts/useCity", () => ({ useCity: () => ({ city: "boston" }) }));

const ZONE = "America/New_York";

/** An approved event starting `hour` (local) on the night `daysFromMonday` into the week. */
function makeEvent(id: string, title: string, weekStart: string, daysFromMonday: number, hour: number): DatabaseEvent {
  const start = Temporal.PlainDate.from(weekStart)
    .add({ days: daysFromMonday })
    .toZonedDateTime({ timeZone: ZONE, plainTime: { hour } })
    .toInstant()
    .toString();
  return {
    id,
    title,
    description: null,
    event_type: "social",
    event_types: ["social"],
    event_date: start,
    event_time: null,
    location: `${title} Hall`,
    address: null,
    price_type: "paid",
    price_amount: 15,
    rsvp_link: null,
    image_url: `https://cdn.example/${id}.jpg`,
    image_urls: [`https://cdn.example/${id}.jpg`],
    status: "approved",
    source_type: "admin",
    taxonomy_term_ids: [],
    taxonomy_terms: [],
    updated_at: "2026-11-01T00:00:00.000Z",
    city: "boston",
    sublocation: null,
    neighborhood: null,
    created_at: "2026-10-01T00:00:00.000Z",
    host: "Host Crew",
    recurrence: null,
    gallery: null,
    venue_id: null,
  } as DatabaseEvent;
}

const WEEK = "2026-11-09";
const friday = makeEvent("ev-fri", "Friday Social", WEEK, 4, 21);
const tuesday = makeEvent("ev-tue", "Tuesday Practica", WEEK, 1, 20);

function savedItinerary(overrides: Partial<Itinerary> = {}): Itinerary {
  return {
    id: "it-1",
    city: "boston",
    weekStart: WEEK,
    timeZone: ZONE,
    title: "Boston week",
    description: null,
    recommendations: null,
    unfeaturedDays: [],
    status: "draft",
    coverImageUrl: null,
    coverGeneratedAt: null,
    publishedAt: null,
    updatedAt: "2026-11-02T00:00:00.000Z",
    ...overrides,
  };
}

function savedDraft(items: ItineraryDraft["items"]): ItineraryDraft {
  return {
    id: "it-1",
    city: "boston",
    weekStart: WEEK,
    timeZone: ZONE,
    title: "Boston week",
    description: null,
    recommendations: null,
    unfeaturedDays: [],
    items,
  };
}

function LocationProbe() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/itineraries/new" element={<AdminItineraryEditorPage />} />
          <Route path="/admin/itineraries/:id" element={<AdminItineraryEditorPage />} />
          <Route path="/admin/itineraries/:id/preview" element={<AdminItineraryPreviewPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function loadSaved(itinerary: Itinerary, draft: ItineraryDraft) {
  queries.useItineraryDraft.mockImplementation((id: string | null) =>
    id ? { itinerary, draft, loading: false, error: null } : { itinerary: null, draft: null, loading: false, error: null }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  publisher.loadItineraryPoster.mockResolvedValue(null);
  publisher.sharePosterFile.mockResolvedValue("shared");
  poster.capturePosterElement.mockImplementation(async (load: () => Promise<unknown>) => {
    await load();
    return new Blob(["poster"], { type: "image/png" });
  });
  queries.useItineraryDraft.mockReturnValue({ itinerary: null, draft: null, loading: false, error: null });
  queries.useWeekEvents.mockReturnValue({ events: [friday, tuesday], loading: false, error: null });
  events.fetchApprovedEventsByIds.mockImplementation(async (ids: string[]) =>
    [friday, tuesday].filter((event) => ids.includes(event.id))
  );
});

describe("AdminItineraryEditorPage", () => {
  it("previews current words, all seven nights, selections and removals without saving", async () => {
    const user = userEvent.setup();
    renderAt("/admin/itineraries/new");
    fireEvent.change(screen.getByLabelText("Week of"), { target: { value: WEEK } });
    await user.click(screen.getByRole("button", { name: "Preview" }));
    let guide = screen.getByRole("region", { name: "Guide preview" });
    expect(within(guide).getByText("Draft — not public")).toBeInTheDocument();
    expect(within(guide).getByText("No events picked yet. Add approved events to build this week.")).toBeInTheDocument();
    expect(within(guide).getAllByRole("heading", { level: 2 })).toHaveLength(7);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fresh picks" } });
    fireEvent.change(screen.getByLabelText("Introduction"), { target: { value: "This is the introduction." } });
    fireEvent.change(screen.getByLabelText("Recommendations"), { target: { value: "Bring dance shoes." } });
    const finder = screen.getByRole("region", { name: "Find events" });
    await user.click(within(within(finder).getByRole("listitem", { name: "Friday Social" })).getByRole("button", { name: "Feature" }));
    const row = await within(screen.getByRole("region", { name: "Schedule" })).findByRole("listitem", { name: "Friday Social" });
    fireEvent.change(within(row).getByLabelText(/Note/), { target: { value: "Arrive for the band." } });

    await user.click(screen.getByRole("button", { name: "Preview" }));
    guide = screen.getByRole("region", { name: "Guide preview" });
    expect(within(guide).getByRole("heading", { level: 1, name: "Fresh picks" })).toBeInTheDocument();
    expect(within(guide).getByText("This is the introduction.")).toBeInTheDocument();
    expect(within(guide).getByText("Bring dance shoes.")).toBeInTheDocument();
    expect(within(guide).getByRole("button", { name: "Friday Social" })).toBeInTheDocument();
    expect(within(guide).getByText("Arrive for the band.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(within(row).getByRole("button", { name: "Remove Friday Social" }));
    await user.click(screen.getByRole("button", { name: "Preview" }));
    guide = screen.getByRole("region", { name: "Guide preview" });
    expect(within(guide).queryByRole("button", { name: "Friday Social" })).not.toBeInTheDocument();
    expect(within(guide).getByText("No events picked yet. Add approved events to build this week.")).toBeInTheDocument();
    expect(repo.saveItinerary).not.toHaveBeenCalled();
  });

  it("exports the saved published title and picks while its guide previews unsaved changes", async () => {
    const user = userEvent.setup();
    loadSaved(
      savedItinerary({ status: "published", coverGeneratedAt: "2026-11-03T00:00:00.000Z" }),
      savedDraft([{ eventId: "ev-fri", role: "featured", position: 0, note: null }])
    );
    renderAt("/admin/itineraries/it-1");
    const schedule = screen.getByRole("region", { name: "Schedule" });
    const row = await within(schedule).findByRole("listitem", { name: "Friday Social" });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Unsaved edition" } });
    await user.click(within(row).getByRole("button", { name: "Remove Friday Social" }));
    const guide = screen.getByRole("region", { name: "Guide preview" });
    expect(within(guide).getByRole("heading", { name: "Unsaved edition", level: 1 })).toBeInTheDocument();
    expect(within(guide).queryByRole("button", { name: "Friday Social" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Posters" }));
    expect(screen.getByText("Save changes to share updated words and picks. Posters use the saved week.")).toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "Share posters" });
    await user.click(within(panel).getByRole("button", { name: "Download" }));
    await waitFor(() => expect(poster.downloadBlob).toHaveBeenCalled());
    expect(publisher.loadItineraryPoster).toHaveBeenLastCalledWith(
      expect.objectContaining({
        itinerary: expect.objectContaining({ title: "Boston week" }),
        nights: expect.arrayContaining([
          expect.objectContaining({ featured: expect.objectContaining({ event: expect.objectContaining({ id: "ev-fri" }) }) }),
        ]),
      }),
      "story"
    );
    await user.click(within(panel).getByRole("button", { name: "Share" }));
    await waitFor(() => expect(publisher.sharePosterFile).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Boston week",
        url: "https://www.salsasegura.com/itineraries/boston/2026-11-09",
      })
    ));
    expect(repo.saveItinerary).not.toHaveBeenCalled();
  });

  it("blocks publishing and saving a whitespace title, including a requested confirmation", async () => {
    const user = userEvent.setup();
    loadSaved(
      savedItinerary({ title: "   " }),
      { ...savedDraft([{ eventId: "ev-fri", role: "featured", position: 0, note: null }]), title: "   " }
    );
    renderAt("/admin/itineraries/it-1?publish=1");
    await within(screen.getByRole("region", { name: "Schedule" })).findByRole("listitem", { name: "Friday Social" });

    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add a title before saving or publishing.");
    expect(repo.saveItinerary).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("offers supported cities with no upcoming events and saves an empty draft for one", async () => {
    const user = userEvent.setup();
    queries.useWeekEvents.mockReturnValue({ events: [], loading: false, error: null });
    repo.saveItinerary.mockResolvedValue("it-sf");
    renderAt("/admin/itineraries/new");

    await user.selectOptions(screen.getByLabelText("City"), "san-francisco");
    expect(screen.getByRole("option", { name: "San Francisco" })).toBeInTheDocument();
    expect(screen.getByText("No approved events in this city this week.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Title"), "San Francisco week");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() =>
      expect(repo.saveItinerary).toHaveBeenCalledWith(
        expect.objectContaining({ city: "san-francisco", timeZone: "America/Los_Angeles", items: [] })
      )
    );
  });

  it("waits for picked events before opening a requested confirmation and publishes only on confirmation", async () => {
    const user = userEvent.setup();
    loadSaved(savedItinerary(), savedDraft([{ eventId: "ev-fri", role: "featured", position: 0, note: null }]));
    let resolvePicked!: (value: DatabaseEvent[]) => void;
    events.fetchApprovedEventsByIds.mockReturnValue(new Promise<DatabaseEvent[]>((resolve) => {
      resolvePicked = resolve;
    }));
    publisher.publish.mockResolvedValue(undefined);
    renderAt("/admin/itineraries/it-1?publish=1");

    await waitFor(() => expect(events.fetchApprovedEventsByIds).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(publisher.publish).not.toHaveBeenCalled();
    await act(async () => resolvePicked([friday]));

    const dialog = await screen.findByRole("dialog", { name: "Publish Boston week?" });
    expect(publisher.publish).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(publisher.publish).toHaveBeenCalledWith("it-1", expect.anything()));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not reopen a requested confirmation after the curator cancels", async () => {
    const user = userEvent.setup();
    loadSaved(savedItinerary(), savedDraft([{ eventId: "ev-fri", role: "featured", position: 0, note: null }]));
    renderAt("/admin/itineraries/it-1?publish=1");
    const dialog = await screen.findByRole("dialog", { name: "Publish Boston week?" });

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await user.type(screen.getByLabelText("Title"), "!");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("shows blocking warnings instead of opening a requested confirmation for an invalid saved draft", async () => {
    loadSaved(savedItinerary(), savedDraft([{ eventId: "ev-gone", role: "featured", position: 0, note: null }]));
    renderAt("/admin/itineraries/it-1?publish=1");

    const summary = await screen.findByRole("region", { name: "Warnings" });
    expect(within(summary).getByText(/No longer public \(cancelled, unpublished or removed\)/)).toBeInTheDocument();
    await waitFor(() => expect(events.fetchApprovedEventsByIds).toHaveBeenCalledWith(["ev-gone"]));
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("demotes the earlier featured pick when a second event is featured on the same night", async () => {
    const user = userEvent.setup();
    const week = defaultWeekStart(Temporal.Now.instant(), ZONE);
    const early = makeEvent("ev-early", "Early Social", week, 4, 20);
    const late = makeEvent("ev-late", "Late Social", week, 4, 23);
    queries.useWeekEvents.mockReturnValue({ events: [early, late], loading: false, error: null });
    events.fetchApprovedEventsByIds.mockImplementation(async (ids: string[]) =>
      [early, late].filter((event) => ids.includes(event.id))
    );
    repo.saveItinerary.mockResolvedValue("it-new");

    renderAt("/admin/itineraries/new");
    const finder = screen.getByRole("region", { name: "Find events" });

    await user.click(within(within(finder).getByRole("listitem", { name: "Early Social" })).getByRole("button", { name: "Feature" }));
    const lateResult = within(finder).getByRole("listitem", { name: "Late Social" });
    expect(within(lateResult).getByText("Featured: Early Social")).toBeInTheDocument();
    await user.click(within(lateResult).getByRole("button", { name: "Feature" }));

    const schedule = screen.getByRole("region", { name: "Schedule" });
    const earlyRow = await within(schedule).findByRole("listitem", { name: "Early Social" });
    expect(within(earlyRow).getByRole("button", { name: /Featured/ })).toHaveAttribute("aria-pressed", "false");
    expect(
      within(within(schedule).getByRole("listitem", { name: "Late Social" })).getByRole("button", { name: /Featured/ })
    ).toHaveAttribute("aria-pressed", "true");

    await user.type(screen.getByLabelText("Title"), "Boston this week");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(repo.saveItinerary).toHaveBeenCalledTimes(1));
    const sent = repo.saveItinerary.mock.calls[0][0] as ItineraryDraft;
    expect(sent.items).toEqual(
      expect.arrayContaining([
        { eventId: "ev-late", role: "featured", position: 0, note: null },
        { eventId: "ev-early", role: "alternative", position: 1, note: null },
      ])
    );
    expect(sent.weekStart).toBe(week);
    expect(sent.timeZone).toBe(ZONE);
    const byId = new Map([early, late].map((event) => [event.id, event]));
    expect(itineraryWarnings(sent, byId).map((warning) => warning.code)).not.toContain("two_featured");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/admin/itineraries/it-new"));
  });

  it("blocks publishing and summarizes an event that is no longer public", async () => {
    loadSaved(
      savedItinerary(),
      savedDraft([
        { eventId: "ev-fri", role: "featured", position: 0, note: null },
        { eventId: "ev-gone", role: "alternative", position: 0, note: "Was great" },
      ])
    );

    renderAt("/admin/itineraries/it-1");

    const summary = await screen.findByRole("region", { name: "Warnings" });
    expect(within(summary).getByText(/No longer public \(cancelled, unpublished or removed\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("restores a saved draft's items under their nights", async () => {
    loadSaved(
      savedItinerary(),
      savedDraft([
        { eventId: "ev-fri", role: "featured", position: 0, note: "Live band" },
        { eventId: "ev-tue", role: "alternative", position: 0, note: null },
      ])
    );

    renderAt("/admin/itineraries/it-1");

    const fridayNight = await screen.findByRole("region", { name: "Friday, Nov 13" });
    const fridayRow = await within(fridayNight).findByRole("listitem", { name: "Friday Social" });
    expect(within(fridayRow).getByRole("button", { name: /Featured/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(fridayRow).getByLabelText(/Note/)).toHaveValue("Live band");
    const tuesdayNight = screen.getByRole("region", { name: "Tuesday, Nov 10" });
    expect(within(tuesdayNight).getByRole("listitem", { name: "Tuesday Practica" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Boston week");
    // Tuesday has no featured pick: a warning, never a blocker.
    expect(within(screen.getByRole("region", { name: "Warnings" })).getByText("Nothing blocks publishing.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("flags the link card as out of date when the refresh after a published save fails", async () => {
    const user = userEvent.setup();
    loadSaved(
      savedItinerary({
        status: "published",
        coverImageUrl: "https://storage.example/it-1/old.jpg",
        coverGeneratedAt: "2026-11-03T00:00:00.000Z",
        publishedAt: "2026-11-03T00:00:00.000Z",
      }),
      savedDraft([{ eventId: "ev-fri", role: "featured", position: 0, note: null }])
    );
    repo.saveItinerary.mockResolvedValue("it-1");
    publisher.refreshCard.mockRejectedValue({ message: "Upload failed" });

    renderAt("/admin/itineraries/it-1");

    await screen.findByRole("listitem", { name: "Friday Social" });
    expect(screen.queryByText(/Link preview image is out of date/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("City")).toBeDisabled();

    await user.type(screen.getByLabelText("Title"), " again");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(publisher.refreshCard).toHaveBeenCalledWith("it-1", expect.anything()));
    expect(await screen.findByText(/Link preview image is out of date —/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(repo.setItineraryStatus).not.toHaveBeenCalled();
  });

  it("warns before unloading only while there are unsaved changes", async () => {
    const user = userEvent.setup();
    loadSaved(savedItinerary(), savedDraft([{ eventId: "ev-fri", role: "featured", position: 0, note: null }]));
    renderAt("/admin/itineraries/it-1");
    await screen.findByRole("listitem", { name: "Friday Social" });

    const pristine = new Event("beforeunload", { cancelable: true });
    const pristineSpy = vi.spyOn(pristine, "preventDefault");
    window.dispatchEvent(pristine);
    expect(pristineSpy).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Title"), "!");
    const dirty = new Event("beforeunload", { cancelable: true });
    const dirtySpy = vi.spyOn(dirty, "preventDefault");
    window.dispatchEvent(dirty);
    expect(dirtySpy).toHaveBeenCalled();
  });

  it("offers Share and Copy link only once the week is published", async () => {
    loadSaved(savedItinerary(), savedDraft([{ eventId: "ev-fri", role: "featured", position: 0, note: null }]));
    const { unmount } = renderAt("/admin/itineraries/it-1");
    await userEvent.setup().click(screen.getByRole("button", { name: "Posters" }));
    const panel = await screen.findByRole("region", { name: "Share posters" });
    expect(within(panel).getByRole("button", { name: /Download/ })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Share/ })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Copy link/ })).not.toBeInTheDocument();
    unmount();

    loadSaved(
      savedItinerary({ status: "published", coverGeneratedAt: "2026-11-03T00:00:00.000Z" }),
      savedDraft([{ eventId: "ev-fri", role: "featured", position: 0, note: null }])
    );
    renderAt("/admin/itineraries/it-1");
    await userEvent.setup().click(screen.getByRole("button", { name: "Posters" }));
    const published = await screen.findByRole("region", { name: "Share posters" });
    expect(within(published).getByRole("button", { name: /Share/ })).toBeInTheDocument();
    expect(within(published).getByRole("button", { name: /Copy link/ })).toBeInTheDocument();
  });
});

describe("AdminItineraryPreviewPage", () => {
  it("gives an empty draft a build-this-week prompt rather than a removed-events message", async () => {
    loadSaved(savedItinerary(), savedDraft([]));
    renderAt("/admin/itineraries/it-1/preview");

    expect(await screen.findByText("No events picked yet. Add approved events to build this week.")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(7);
    expect(screen.queryByText(/Every event on this week's list has been cancelled or removed/)).not.toBeInTheDocument();
  });

  it("renders the public page with the draft banner", async () => {
    loadSaved(savedItinerary(), savedDraft([{ eventId: "ev-fri", role: "featured", position: 0, note: null }]));

    renderAt("/admin/itineraries/it-1/preview");

    expect(await screen.findByText("Draft — not public")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Boston week" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Friday Social" })).toBeInTheDocument();
  });
});
