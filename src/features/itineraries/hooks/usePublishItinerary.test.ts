import "temporal-polyfill/global";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { DatabaseEvent } from "../../../types/events";
import { buildSchedule } from "../model/schedule";
import { usePublishItinerary } from "./usePublishItinerary";

const mocks = vi.hoisted(() => ({
  capturePosterElement: vi.fn(),
  resolvePosterImageForEvent: vi.fn(),
  encodeLinkCard: vi.fn(),
  uploadItineraryCover: vi.fn(),
  setItineraryCover: vi.fn(),
  setItineraryStatus: vi.fn(),
}));

vi.mock("../../calendar/hooks/useShareablePoster", () => ({
  useShareablePoster: () => ({ capturePosterElement: mocks.capturePosterElement }),
}));
vi.mock("../../calendar/api/posterFlyers", () => ({
  resolvePosterImageForEvent: mocks.resolvePosterImageForEvent,
}));
vi.mock("../model/linkCard", () => ({ encodeLinkCard: mocks.encodeLinkCard }));
vi.mock("../api/itinerariesRepo", async (importOriginal) => ({
  ...(await importOriginal()),
  uploadItineraryCover: mocks.uploadItineraryCover,
  setItineraryCover: mocks.setItineraryCover,
  setItineraryStatus: mocks.setItineraryStatus,
}));

const event = {
  id: "ev-fri",
  title: "Friday Social",
  event_type: "social",
  event_date: "2026-11-14T02:00:00.000Z",
  location: "Copacabana",
  image_url: "https://cdn.example/fri.jpg",
  poster_image_url: null,
  city: "boston",
  status: "approved",
  taxonomy_terms: [],
} as unknown as DatabaseEvent;

const draft = {
  weekStart: "2026-11-09",
  timeZone: "America/New_York",
  unfeaturedDays: [],
  items: [{ eventId: "ev-fri", role: "featured" as const, position: 0, note: null }],
};

const inputs = {
  itinerary: { city: "boston", weekStart: "2026-11-09", timeZone: "America/New_York", title: "Boston week" },
  cityName: "Boston",
  nights: buildSchedule(draft, new Map([[event.id, event]])).nights,
};

const expectedSnapshot = {
  city: "boston",
  city_name: "Boston",
  week_start: "2026-11-09",
  time_zone: "America/New_York",
  title: "Boston week",
  items: [{
    event_id: "ev-fri",
    role: "featured",
    position: 0,
    note: null,
    event: {
      id: "ev-fri",
      city: "boston",
      status: "approved",
      title: "Friday Social",
      event_date_ms: Temporal.Instant.from("2026-11-14T02:00Z").epochMilliseconds,
      event_type: "social",
      location: "Copacabana",
      artwork_source: "https://cdn.example/fri.jpg",
      dance_styles: [],
    },
  }],
};

const png = new Blob(["png"], { type: "image/png" });
const jpeg = new Blob(["jpeg"], { type: "image/jpeg" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.capturePosterElement.mockImplementation(async (load: (assertActive: () => void) => Promise<ReactElement>) => {
    await load(() => {});
    return png;
  });
  mocks.resolvePosterImageForEvent.mockResolvedValue({ status: "ready", dataUrl: "data:image/jpeg;base64,AA" });
  mocks.encodeLinkCard.mockResolvedValue(jpeg);
  mocks.uploadItineraryCover.mockResolvedValue("https://storage.example/it-1/abcd1234.jpg");
  mocks.setItineraryCover.mockResolvedValue("2026-11-05T12:00:00.000Z");
  mocks.setItineraryStatus.mockResolvedValue("2026-11-05T12:00:01.000Z");
});

describe("usePublishItinerary", () => {
  it("renders the card, encodes, uploads, stores the cover and then publishes, in that order", async () => {
    const { result } = renderHook(() => usePublishItinerary());

    await act(() => result.current.publish("it-1", inputs));

    expect(mocks.resolvePosterImageForEvent).toHaveBeenCalledWith({
      eventId: "ev-fri",
      sourceUrl: "https://cdn.example/fri.jpg",
      cachedUrl: null,
    });
    expect(mocks.encodeLinkCard).toHaveBeenCalledWith(png);
    expect(mocks.uploadItineraryCover).toHaveBeenCalledWith("it-1", jpeg);
    expect(mocks.setItineraryCover).toHaveBeenCalledWith("it-1", "https://storage.example/it-1/abcd1234.jpg", expectedSnapshot);
    expect(mocks.setItineraryStatus).toHaveBeenCalledWith("it-1", "published");

    const order = [
      mocks.capturePosterElement,
      mocks.encodeLinkCard,
      mocks.uploadItineraryCover,
      mocks.setItineraryCover,
      mocks.setItineraryStatus,
    ].map((fn) => fn.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("captures the 1200×630 card cut", async () => {
    let element: ReactElement | null = null;
    mocks.capturePosterElement.mockImplementation(async (load: (assertActive: () => void) => Promise<ReactElement>) => {
      element = await load(() => {});
      return png;
    });
    const { result } = renderHook(() => usePublishItinerary());

    await act(() => result.current.refreshCard("it-1", inputs));

    const props = (element as unknown as ReactElement<{ model: { format: string; tiles: { imageUrl: string }[] } }>)
      .props;
    expect(props.model.format).toBe("card");
    expect(props.model.tiles[0].imageUrl).toBe("data:image/jpeg;base64,AA");
  });

  it("stops at a failed upload and never publishes", async () => {
    mocks.uploadItineraryCover.mockRejectedValue({ message: "Bucket unavailable" });
    const { result } = renderHook(() => usePublishItinerary());

    await act(async () => {
      await expect(result.current.publish("it-1", inputs)).rejects.toBeTruthy();
    });

    expect(mocks.setItineraryCover).not.toHaveBeenCalled();
    expect(mocks.setItineraryStatus).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Bucket unavailable");
  });

  it("rejects a stale rendered source without publishing and shows the regeneration error", async () => {
    const message = "The itinerary or its events changed. Reload and regenerate the link preview image.";
    mocks.setItineraryCover.mockRejectedValue({ code: "22023", message });
    const { result } = renderHook(() => usePublishItinerary());

    await act(async () => {
      await expect(result.current.publish("it-1", inputs)).rejects.toEqual({ code: "22023", message });
    });

    expect(mocks.setItineraryCover).toHaveBeenCalledWith("it-1", expect.any(String), expectedSnapshot);
    expect(mocks.setItineraryStatus).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(message);
  });

  it("binds both rendering and registration to the same facts throughout async capture", async () => {
    const mutable = structuredClone(inputs);
    let renderedTitle: string | undefined;
    mocks.resolvePosterImageForEvent.mockImplementation(async () => {
      mutable.itinerary.title = "Changed during flyer loading";
      mutable.nights.flatMap((night) => night.entries)[0].event.title = "Changed in memory";
      return { status: "ready", dataUrl: "data:image/jpeg;base64,AA" };
    });
    mocks.capturePosterElement.mockImplementation(async (load: (assertActive: () => void) => Promise<ReactElement>) => {
      const element = await load(() => {});
      // This in-process element is always ShareableItineraryPoster.
      const props = element.props as { model: { title: string } };
      renderedTitle = props.model.title;
      return png;
    });
    const { result } = renderHook(() => usePublishItinerary());

    await act(() => result.current.publish("it-1", mutable));

    expect(renderedTitle).toBe("Boston week");
    expect(mocks.setItineraryCover).toHaveBeenCalledWith("it-1", expect.any(String), expectedSnapshot);
  });

  it("derives printed dance nights from the captured event facts, not stale precomputed grouping", async () => {
    const changed = structuredClone(inputs);
    changed.nights.flatMap((night) => night.entries)[0].event.event_date = "2026-11-15T02:00Z";
    let renderedDay: string | undefined;
    mocks.capturePosterElement.mockImplementation(async (load: (assertActive: () => void) => Promise<ReactElement>) => {
      const element = await load(() => {});
      // This in-process element is always ShareableItineraryPoster.
      const props = element.props as { model: { tracks: { day: string }[] } };
      renderedDay = props.model.tracks[0].day;
      return png;
    });
    const { result } = renderHook(() => usePublishItinerary());

    await act(() => result.current.refreshCard("it-1", changed));

    expect(renderedDay).toBe("SAT 14");
    expect(mocks.setItineraryCover).toHaveBeenCalledWith("it-1", expect.any(String), {
      ...expectedSnapshot,
      items: [{
        ...expectedSnapshot.items[0],
        event: {
          ...expectedSnapshot.items[0].event,
          event_date_ms: Temporal.Instant.from("2026-11-15T02:00Z").epochMilliseconds,
        },
      }],
    });
  });

  it("refreshes the card without changing the status", async () => {
    const { result } = renderHook(() => usePublishItinerary());

    await act(() => result.current.refreshCard("it-1", inputs));

    expect(mocks.setItineraryCover).toHaveBeenCalledTimes(1);
    expect(mocks.setItineraryStatus).not.toHaveBeenCalled();
  });

  it("uses the fallback art when a featured flyer can't be fetched", async () => {
    mocks.resolvePosterImageForEvent.mockResolvedValue({ status: "unavailable" });
    let element: ReactElement | null = null;
    mocks.capturePosterElement.mockImplementation(async (load: (assertActive: () => void) => Promise<ReactElement>) => {
      element = await load(() => {});
      return png;
    });
    const { result } = renderHook(() => usePublishItinerary());

    await act(() => result.current.refreshCard("it-1", inputs));

    const props = (element as unknown as ReactElement<{ model: { tiles: { artKind: string }[] } }>).props;
    expect(props.model.tiles[0].artKind).toBe("fallback");
  });
});
