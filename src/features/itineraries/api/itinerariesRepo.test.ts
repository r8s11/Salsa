import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItineraryDraft } from "../model/types";
import { itineraryErrorMessage, saveItinerary, setItineraryCover, uploadItineraryCover } from "./itinerariesRepo";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: vi.fn(),
    storage: { from: mocks.storageFrom },
  },
}));

const draft: ItineraryDraft = {
  id: null,
  city: "boston",
  weekStart: "2026-11-02",
  timeZone: "America/New_York",
  title: "This week in Boston",
  description: "Good week",
  recommendations: null,
  unfeaturedDays: [1, 7],
  items: [{ eventId: "event-1", role: "featured", position: 0, note: "Bring water" }],
};

describe("itinerariesRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageFrom.mockReturnValue({ upload: mocks.upload, getPublicUrl: mocks.getPublicUrl });
  });

  it("saveItinerary sends the snake_case payload to save_itinerary", async () => {
    mocks.rpc.mockResolvedValue({ data: "new-id", error: null });

    await expect(saveItinerary(draft)).resolves.toBe("new-id");

    expect(mocks.rpc).toHaveBeenCalledWith("save_itinerary", {
      p_id: null,
      p_payload: {
        city: "boston",
        week_start: "2026-11-02",
        time_zone: "America/New_York",
        title: "This week in Boston",
        description: "Good week",
        recommendations: null,
        unfeatured_days: [1, 7],
        items: [{ event_id: "event-1", role: "featured", position: 0, note: "Bring water" }],
      },
    });
  });

  it("saveItinerary rethrows Supabase errors with their code", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    const error = await saveItinerary(draft).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(itineraryErrorMessage(error)).toBe("An itinerary for this city and week already exists.");
  });

  it("itineraryErrorMessage maps known codes and falls back to the message", () => {
    expect(itineraryErrorMessage({ code: "23505" })).toBe(
      "An itinerary for this city and week already exists."
    );
    expect(itineraryErrorMessage({ code: "42501" })).toBe(
      "You need moderator access to change itineraries."
    );
    expect(itineraryErrorMessage({ code: "22023", message: "Only one featured event per night" })).toBe(
      "Only one featured event per night"
    );
  });

  it("uploadItineraryCover uploads a jpeg under the itinerary folder with an 8-hex name", async () => {
    mocks.upload.mockResolvedValue({ data: {}, error: null });
    mocks.getPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn/itinerary-covers/${path}` },
    }));

    const url = await uploadItineraryCover("itin-1", new Blob(["jpeg"], { type: "image/jpeg" }));

    expect(mocks.storageFrom).toHaveBeenCalledWith("itinerary-covers");
    const [path, , options] = mocks.upload.mock.calls[0];
    expect(path).toMatch(/^itin-1\/[0-9a-f]{8}\.jpg$/);
    expect(options).toEqual({ upsert: true, contentType: "image/jpeg" });
    expect(url).toBe(`https://cdn/itinerary-covers/${path}`);
  });

  it("registers the render's source facts and preserves a stale-source regeneration error", async () => {
    const snapshot = {
      city: "boston", city_name: "Boston", week_start: draft.weekStart,
      time_zone: draft.timeZone, title: draft.title, items: [],
    };
    mocks.rpc.mockResolvedValueOnce({ data: "2026-11-03T12:00Z", error: null });
    await expect(setItineraryCover("itin-1", "https://cdn/cover.jpg", snapshot)).resolves.toBe("2026-11-03T12:00Z");
    expect(mocks.rpc).toHaveBeenCalledWith("set_itinerary_cover", {
      p_id: "itin-1", p_url: "https://cdn/cover.jpg", p_snapshot: snapshot,
    });

    const message = "The itinerary or its events changed. Reload and regenerate the link preview image.";
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message } });
    const error = await setItineraryCover("itin-1", "https://cdn/cover.jpg", snapshot).catch((e: unknown) => e);
    expect(itineraryErrorMessage(error)).toBe(message);
  });
});
