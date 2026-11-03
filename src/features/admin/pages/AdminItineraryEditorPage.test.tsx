import "temporal-polyfill/global";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
const publisher = vi.hoisted(() => ({ publish: vi.fn(), refreshCard: vi.fn() }));
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
  usePublishItinerary: () => ({ ...publisher, status: "idle", error: null }),
}));
vi.mock("../../calendar/hooks/useShareablePoster", () => ({ useShareablePoster: () => poster }));
vi.mock("../../metros/hooks/useMetros", () => ({
  useActiveMetros: () => ({ activeMetros: [{ slug: "boston", name: "Boston" }], loading: false, error: null }),
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
  queries.useItineraryDraft.mockReturnValue({ itinerary: null, draft: null, loading: false, error: null });
  queries.useWeekEvents.mockReturnValue({ events: [friday, tuesday], loading: false, error: null });
  events.fetchApprovedEventsByIds.mockImplementation(async (ids: string[]) =>
    [friday, tuesday].filter((event) => ids.includes(event.id))
  );
});

describe("AdminItineraryEditorPage", () => {
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
    const published = await screen.findByRole("region", { name: "Share posters" });
    expect(within(published).getByRole("button", { name: /Share/ })).toBeInTheDocument();
    expect(within(published).getByRole("button", { name: /Copy link/ })).toBeInTheDocument();
  });
});

describe("AdminItineraryPreviewPage", () => {
  it("renders the public page with the draft banner", async () => {
    loadSaved(savedItinerary(), savedDraft([{ eventId: "ev-fri", role: "featured", position: 0, note: null }]));

    renderAt("/admin/itineraries/it-1/preview");

    expect(await screen.findByText("Draft — not public")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Boston week" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Friday Social" })).toBeInTheDocument();
  });
});
