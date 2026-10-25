import "temporal-polyfill/global";
import { describe, expect, it } from "vitest";
import { draftToAdminPayload, draftToOrganizerCreatePayload, resolveDraftTimeZone } from "./types";
import type { EventFormDraft } from "./types";
import { buildAdminFormFromEvent, validateAdminEventForm } from "../../../admin/model/adminEventForm";
import { fromEventDateInstant } from "../../model/eventDateTime";
import type { DatabaseEvent } from "../../model/types";

const draft = (overrides: Partial<EventFormDraft> = {}): EventFormDraft => ({
  title: "Saturday Social",
  description: "",
  event_type: "social",
  city: "new-york-city",
  sublocation: "",
  event_date: "2026-07-18",
  event_time: "20:00",
  recurrence: "weekly",
  location: "Hall",
  address: "1 Main St",
  venue_id: "",
  price_type: "free",
  price_amount: "",
  rsvp_link: "",
  image_url: "",
  image_urls: [],
  host: "",
  contact_email: "",
  contact_instagram: "",
  contact_website: "",
  submitter_name: "",
  submitter_email: "",
  dance_styles: [],
  taxonomy_term_ids: [],
  ...overrides,
});

const storedEvent = (overrides: Partial<DatabaseEvent> = {}): DatabaseEvent => ({
  id: "event-1",
  title: "Saturday Social",
  description: null,
  event_type: "social",
  city: "los-angeles",
  sublocation: null,
  event_date: "2026-07-19T03:00:00Z", // 8pm in Los Angeles (PDT)
  event_time: "20:00",
  location: null,
  address: null,
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: null,
  host: null,
  recurrence: "weekly",
  gallery: null,
  source_type: "admin",
  taxonomy_terms: [],
  taxonomy_term_ids: [],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  status: "approved",
  venue_id: null,
  ...overrides,
});

describe("draft time zone -> stored instant", () => {
  it.each([
    ["NYC", "new-york-city", "2026-07-19T00:00:00Z"],
    ["Boston", "boston", "2026-07-19T00:00:00Z"],
    ["Chicago", "chicago", "2026-07-19T01:00:00Z"],
    ["Los Angeles", "los-angeles", "2026-07-19T03:00:00Z"],
    ["London", "london", "2026-07-18T19:00:00Z"],
  ])("%s 8pm is stored as the right instant for its own zone", (_label, city, instant) => {
    expect(draftToAdminPayload(draft({ city })).event_date).toBe(instant);
  });

  it("uses the linked venue's zone over the city metro", () => {
    const payload = draftToAdminPayload(
      draft({ city: "new-york-city", venue_time_zone: "America/Chicago" })
    );
    expect(payload.event_date).toBe("2026-07-19T01:00:00Z");
  });

  it("uses an explicit event zone over venue, series and metro", () => {
    const payload = draftToAdminPayload(
      draft({
        city: "new-york-city",
        time_zone: "America/Los_Angeles",
        venue_time_zone: "America/Chicago",
        series_time_zone: "America/Denver",
      })
    );
    expect(payload.event_date).toBe("2026-07-19T03:00:00Z");
  });

  it("inherits the series zone when the event has none", () => {
    const payload = draftToOrganizerCreatePayload(
      draft({ city: "new-york-city", series_time_zone: "America/Chicago" })
    );
    expect(payload.event_date).toBe("2026-07-19T01:00:00Z");
  });

  it("never persists the in-memory zone hints as event columns", () => {
    const payload = draftToAdminPayload(
      draft({ time_zone: "America/Chicago", venue_time_zone: "America/Chicago", series_time_zone: "America/Chicago" })
    );
    expect(payload).not.toHaveProperty("time_zone");
    expect(payload).not.toHaveProperty("venue_time_zone");
    expect(payload).not.toHaveProperty("series_time_zone");
  });

  it("refuses to save with a helpful message when the zone is invalid, instead of using another zone", () => {
    expect(() => draftToAdminPayload(draft({ time_zone: "Mars/Olympus" }))).toThrow(/Mars\/Olympus.*IANA/s);
  });

  it("refuses to save when no zone can be resolved", () => {
    expect(() => draftToAdminPayload(draft({ city: "atlantis" }))).toThrow(/no time zone/i);
  });
});

describe("edit then save keeps the local hour (non-Eastern events)", () => {
  it.each([
    ["Los Angeles", "los-angeles", "2026-07-19T03:00:00Z"],
    ["Chicago", "chicago", "2026-07-19T01:00:00Z"],
  ])("%s: load into the form, save unchanged -> same instant", (_label, city, instant) => {
    const form = buildAdminFormFromEvent(storedEvent({ city, event_date: instant }));
    expect(form.event_time).toBe("20:00");
    expect(form.event_date).toBe("2026-07-18");
    expect(draftToAdminPayload(form).event_date).toBe(instant);
  });

  it("an event carrying a venue zone loads and saves in that zone", () => {
    const event = storedEvent({ city: "new-york-city", event_date: "2026-07-19T01:00:00Z", venue_time_zone: "America/Chicago" });
    const form = buildAdminFormFromEvent(event);
    expect(form.event_time).toBe("20:00");
    expect(form.venue_time_zone).toBe("America/Chicago");
    expect(draftToAdminPayload(form).event_date).toBe("2026-07-19T01:00:00Z");
  });

  it("changing only the time keeps the date and the zone", () => {
    const form = buildAdminFormFromEvent(storedEvent());
    const payload = draftToAdminPayload({ ...form, event_time: "21:30" });
    expect(fromEventDateInstant(payload.event_date, "America/Los_Angeles")).toEqual({
      date: "2026-07-18",
      time: "21:30",
    });
  });

  it("an explicit override on an existing event survives the load -> save cycle", () => {
    const form = buildAdminFormFromEvent(
      storedEvent({ city: "new-york-city", event_date: "2026-07-19T03:00:00Z", time_zone: "America/Los_Angeles" })
    );
    expect(form.time_zone).toBe("America/Los_Angeles");
    expect(form.event_time).toBe("20:00");
    expect(draftToAdminPayload(form).event_date).toBe("2026-07-19T03:00:00Z");
  });
});

describe("daylight saving at the save boundary", () => {
  it("keeps 8pm Los Angeles on both sides of spring-forward", () => {
    const before = draftToAdminPayload(draft({ city: "los-angeles", event_date: "2026-03-07" }));
    const after = draftToAdminPayload(draft({ city: "los-angeles", event_date: "2026-03-08" }));
    expect(before.event_date).toBe("2026-03-08T04:00:00Z"); // PST, UTC-8
    expect(after.event_date).toBe("2026-03-09T03:00:00Z"); // PDT, UTC-7
    expect(fromEventDateInstant(after.event_date, "America/Los_Angeles").time).toBe("20:00");
  });

  it("keeps 8pm Chicago on both sides of fall-back", () => {
    const before = draftToAdminPayload(draft({ city: "chicago", event_date: "2026-10-31" }));
    const after = draftToAdminPayload(draft({ city: "chicago", event_date: "2026-11-01" }));
    expect(before.event_date).toBe("2026-11-01T01:00:00Z"); // CDT, UTC-5
    expect(after.event_date).toBe("2026-11-02T02:00:00Z"); // CST, UTC-6
  });
});

describe("validateAdminEventForm time zone", () => {
  it("rejects an unresolved zone with the helpful message", () => {
    const form = buildAdminFormFromEvent(storedEvent({ city: "atlantis" }));
    expect(validateAdminEventForm(form)).toMatch(/no time zone/i);
  });

  it("rejects an invalid explicit zone and names it", () => {
    const form = { ...buildAdminFormFromEvent(storedEvent()), time_zone: "Not/AZone" };
    expect(validateAdminEventForm(form)).toMatch(/Not\/AZone.*IANA/s);
  });

  it("accepts a valid inherited zone", () => {
    const form = buildAdminFormFromEvent(storedEvent());
    expect(resolveDraftTimeZone(form)).toMatchObject({ ok: true, timeZone: "America/Los_Angeles", source: "metro" });
    expect(validateAdminEventForm(form)).toBeNull();
  });
});
