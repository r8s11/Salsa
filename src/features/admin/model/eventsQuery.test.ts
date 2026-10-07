import { describe, expect, it } from "vitest";
import type { DatabaseEvent } from "../../events/model/types";
import {
  applyView,
  applyFilters,
  applySort,
  defaultSortFor,
  eventsListDefinition,
  viewCounts,
  type EventFilters,
} from "./eventsQuery";
import { applyListChange, parseListState } from "./listState";

// Frozen clock: 2026-08-11T16:00:00 UTC == 2026-08-11T12:00:00 America/New_York (EDT, UTC-4).
const NOW = new Date("2026-08-11T16:00:00.000Z");

let nextId = 0;

function makeEvent(overrides: Partial<DatabaseEvent> = {}): DatabaseEvent {
  nextId += 1;
  const base: DatabaseEvent = {
    id: `event-${nextId}`,
    title: `Event ${nextId}`,
    description: "A great event.",
    event_type: "social",
    event_date: "2026-08-15T00:00:00.000Z",
    event_time: "8:00 PM",
    location: "Havana Club",
    address: null,
    price_type: "free",
    price_amount: null,
    rsvp_link: null,
    image_url: "https://example.com/image.jpg",
    submitter_name: "Ada",
    submitter_email: "ada@salsa.test",
    submitter_id: null,
    status: "approved",
    city: "boston",
    created_at: "2026-08-01T00:00:00.000Z",
    host: "DJ Cocolo",
    recurrence: null,
    gallery: null,
    contact_email: null,
    contact_instagram: null,
    contact_website: null,
    source_type: "admin",
    taxonomy_term_ids: ["salsa-id"],
    taxonomy_terms: [
      { id: "salsa-id", name: "Salsa", slug: "salsa", category: "dance_style", status: "active" },
    ],
    updated_at: "2026-08-01T00:00:00.000Z",
    cancellation_reason: null,
    venue_id: null,
  };
  const filtered = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined)
  ) as Partial<DatabaseEvent>;
  return { ...base, ...filtered };
}

const baseFilters: EventFilters = {
  q: "",
  from: null,
  to: null,
  status: [],
  organizer: null,
  venue: null,
  city: null,
  style: null,
  source: null,
  incompleteOnly: false,
  submitter: null,
};

describe("taxonomy filtering", () => {
  it("filters event dance styles by canonical term slug", () => {
    const salsa = makeEvent();
    const bachata = makeEvent({
      taxonomy_term_ids: ["bachata-id"],
      taxonomy_terms: [
        {
          id: "bachata-id",
          name: "Bachata",
          slug: "bachata",
          category: "dance_style",
          status: "active",
        },
      ],
    });
    expect(applyFilters([salsa, bachata], { ...baseFilters, style: "salsa" }, NOW)).toEqual([
      salsa,
    ]);
  });
});

describe("applyView", () => {
  it("all excludes archived but includes cancelled", () => {
    const archived = makeEvent({ status: "archived" });
    const cancelled = makeEvent({ status: "cancelled" });
    const result = applyView([archived, cancelled], "all", NOW);
    expect(result).toEqual([cancelled]);
  });

  it("upcoming includes a cancelled future event and excludes a rejected one", () => {
    const cancelled = makeEvent({ status: "cancelled", event_date: "2026-08-20T00:00:00.000Z" });
    const rejected = makeEvent({ status: "rejected", event_date: "2026-08-20T00:00:00.000Z" });
    const result = applyView([cancelled, rejected], "upcoming", NOW);
    expect(result).toEqual([cancelled]);
  });

  it("an event exactly at startOfToday (NY midnight) counts as upcoming", () => {
    // 2026-08-11T00:00:00 America/New_York == 2026-08-11T04:00:00Z (EDT).
    const atMidnight = makeEvent({ status: "approved", event_date: "2026-08-11T04:00:00.000Z" });
    expect(applyView([atMidnight], "upcoming", NOW)).toEqual([atMidnight]);
  });

  it("an event one minute before startOfToday does not count as upcoming", () => {
    const beforeMidnight = makeEvent({
      status: "approved",
      event_date: "2026-08-11T03:59:00.000Z",
    });
    expect(applyView([beforeMidnight], "upcoming", NOW)).toEqual([]);
  });
});

describe("applyFilters", () => {
  it("from/to bound by New York calendar date — a 9pm event whose UTC date rolls to the next day", () => {
    // 2026-08-15T21:00 America/New_York (EDT, UTC-4) == 2026-08-16T01:00Z.
    const nightEvent = makeEvent({ event_date: "2026-08-16T01:00:00.000Z" });
    const inRange = applyFilters(
      [nightEvent],
      { ...baseFilters, from: "2026-08-15", to: "2026-08-15" },
      NOW
    );
    expect(inRange).toEqual([nightEvent]);
    const outOfRange = applyFilters(
      [nightEvent],
      { ...baseFilters, from: "2026-08-16", to: "2026-08-16" },
      NOW
    );
    expect(outOfRange).toEqual([]);
  });

  it("q matches the city display label 'New York City' and not the raw city value", () => {
    const nyc = makeEvent({ city: "new-york-city", title: "Untitled" });
    expect(applyFilters([nyc], { ...baseFilters, q: "new york city" }, NOW)).toEqual([nyc]);
    expect(applyFilters([nyc], { ...baseFilters, q: "new-york-city" }, NOW)).toEqual([]);
  });

  describe("q search with missing optional fields", () => {
    // events.city has no NOT NULL constraint, but DatabaseEvent.city is typed `string`.
    const noCity = (overrides: Partial<DatabaseEvent> = {}) =>
      makeEvent({ ...overrides, city: null as unknown as string });
    const search = (events: DatabaseEvent[], q: string) =>
      applyFilters(events, { ...baseFilters, q }, NOW);

    it("does not throw when city is null, and still matches on other fields", () => {
      const event = noCity({ title: "Sunset Social" });
      expect(() => search([event], "sun")).not.toThrow();
      expect(search([event], "sun")).toEqual([event]);
      expect(search([event], "zzz")).toEqual([]);
    });

    it("does not exclude a null-city event that matches while keeping city matches for others", () => {
      const nullCity = noCity({ title: "Mambo Night" });
      const nyc = makeEvent({ city: "new-york-city", title: "Untitled" });
      expect(search([nullCity, nyc], "mambo")).toEqual([nullCity]);
      expect(search([nullCity, nyc], "new york")).toEqual([nyc]);
    });

    it("tolerates every nullable searchable field being null at once", () => {
      const sparse = noCity({
        title: "Bare Bones",
        location: null,
        host: null,
        submitter_name: null,
        submitter_email: null,
      });
      expect(search([sparse], "bare")).toEqual([sparse]);
      expect(search([sparse], "havana")).toEqual([]);
    });

    it("matches a partial query against host, location and submitter email", () => {
      const event = makeEvent({ host: "DJ Cocolo", location: "Havana Club" });
      expect(search([event], "coc")).toEqual([event]);
      expect(search([event], "avana cl")).toEqual([event]);
      expect(search([event], "ada@sal")).toEqual([event]);
    });

    it("returns everything for empty or whitespace-only queries, including null-city events", () => {
      const events = [noCity(), makeEvent()];
      expect(search(events, "")).toEqual(events);
      expect(search(events, "   ")).toEqual(events);
    });

    it("is case-insensitive in both directions", () => {
      const event = makeEvent({ title: "Bachata Sensual", city: "new-york-city" });
      expect(search([event], "BACHATA")).toEqual([event]);
      expect(search([event], "sEnSuAl")).toEqual([event]);
      expect(search([event], "NEW YORK")).toEqual([event]);
    });
  });

  it("incompleteOnly matches events with at least one quality issue", () => {
    const complete = makeEvent();
    const incomplete = makeEvent({ location: null });
    const result = applyFilters(
      [complete, incomplete],
      { ...baseFilters, incompleteOnly: true },
      NOW
    );
    expect(result).toEqual([incomplete]);
  });

  it("status filter is a membership check; empty array matches everything", () => {
    const pending = makeEvent({ status: "pending" });
    const approved = makeEvent({ status: "approved" });
    expect(applyFilters([pending, approved], { ...baseFilters, status: ["pending"] }, NOW)).toEqual(
      [pending]
    );
    expect(applyFilters([pending, approved], baseFilters, NOW)).toEqual([pending, approved]);
  });
});

describe("applyFilters — submitter", () => {
  it("matches by submitter_id", () => {
    const mine = makeEvent({ submitter_id: "user-1", submitter_email: "other@salsa.test" });
    const theirs = makeEvent({ submitter_id: "user-2", submitter_email: "another@salsa.test" });
    const result = applyFilters([mine, theirs], { ...baseFilters, submitter: "user-1" }, NOW);
    expect(result).toEqual([mine]);
  });

  it("matches by submitter_email case-insensitively for guest rows", () => {
    const guest = makeEvent({ submitter_id: null, submitter_email: "Guest@Salsa.test" });
    const other = makeEvent({ submitter_id: null, submitter_email: "someoneelse@salsa.test" });
    const result = applyFilters(
      [guest, other],
      { ...baseFilters, submitter: "guest@salsa.test" },
      NOW
    );
    expect(result).toEqual([guest]);
  });

  it("excludes events that match neither submitter_id nor submitter_email", () => {
    const mine = makeEvent({ submitter_id: "user-1", submitter_email: "mine@salsa.test" });
    const result = applyFilters([mine], { ...baseFilters, submitter: "user-2" }, NOW);
    expect(result).toEqual([]);
  });

  it("null submitter filter matches everything", () => {
    const events = [makeEvent(), makeEvent()];
    expect(applyFilters(events, baseFilters, NOW)).toEqual(events);
  });
});

describe("applySort", () => {
  it("sorts by title case-insensitively", () => {
    const b = makeEvent({ title: "banana" });
    const a = makeEvent({ title: "Apple" });
    expect(applySort([b, a], "title", "asc")).toEqual([a, b]);
  });

  it("is stable for equal keys", () => {
    const first = makeEvent({ title: "Same", event_date: "2026-08-15T00:00:00.000Z" });
    const second = makeEvent({ title: "Same", event_date: "2026-08-15T00:00:00.000Z" });
    const third = makeEvent({ title: "Same", event_date: "2026-08-15T00:00:00.000Z" });
    expect(applySort([first, second, third], "event_date", "asc")).toEqual([first, second, third]);
  });
});

describe("defaultSortFor", () => {
  it("upcoming sorts soonest-first; every other view sorts newest-first", () => {
    expect(defaultSortFor("upcoming")).toEqual({ key: "event_date", dir: "asc" });
    expect(defaultSortFor("all")).toEqual({ key: "event_date", dir: "desc" });
    expect(defaultSortFor("archived")).toEqual({ key: "event_date", dir: "desc" });
  });
});

describe("viewCounts", () => {
  it("counts each view over the unfiltered set, independent of applyFilters", () => {
    const pending = makeEvent({ status: "pending", event_date: "2026-08-20T00:00:00.000Z" });
    const archived = makeEvent({ status: "archived" });
    const counts = viewCounts([pending, archived], NOW);
    expect(counts.pending).toBe(1);
    expect(counts.archived).toBe(1);
    expect(counts.all).toBe(1); // excludes archived
  });
});

describe("eventsListDefinition", () => {
  const definition = eventsListDefinition(new Set(["boston", "new-york-city"]), "upcoming");
  const parse = (query: string) => parseListState(definition, new URLSearchParams(query));

  it("reads legacy ?flag=upcoming as the Upcoming view, but an explicit ?view= wins", () => {
    const pendingDefault = eventsListDefinition(new Set(), "pending");
    expect(pendingDefault.view.parse(new URLSearchParams("flag=upcoming"))).toBe("upcoming");
    expect(parse("flag=upcoming&view=archived").view).toBe("archived");
  });

  it("falls back to the route's default view", () => {
    const pendingDefault = eventsListDefinition(new Set(), "pending");
    expect(pendingDefault.view.parse(new URLSearchParams(""))).toBe("pending");
  });

  it("reads ?flag=incomplete as the Missing-info filter, not a view", () => {
    const state = parse("flag=incomplete");
    expect(state.filters.incompleteOnly).toBe(true);
    expect(state.view).toBe("upcoming");
  });

  it("changing view keeps flag=incomplete and drops the legacy flag=upcoming", () => {
    const kept = applyListChange(definition, new URLSearchParams("flag=incomplete&page=3"), {
      view: "all",
    });
    expect(kept.toString()).toBe("flag=incomplete&view=all");
    const dropped = applyListChange(definition, new URLSearchParams("flag=upcoming"), {
      view: "all",
    });
    expect(dropped.toString()).toBe("view=all");
  });

  it("drops unknown metros, statuses and sources", () => {
    const { filters } = parse("city=atlantis&status=pending,bogus&source=fax");
    expect(filters.city).toBeNull();
    expect(filters.status).toEqual(["pending"]);
    expect(filters.source).toBeNull();
    expect(parse("city=boston").filters.city).toBe("boston");
  });

  it("sorts Upcoming soonest-first unless ?dir= is given", () => {
    expect(parse("view=upcoming").sort).toEqual({ key: "event_date", dir: "asc" });
    expect(parse("view=all").sort).toEqual({ key: "event_date", dir: "desc" });
    expect(parse("view=upcoming&sort=title&dir=desc").sort).toEqual({ key: "title", dir: "desc" });
  });
});
