import { describe, expect, it } from "vitest";
import {
  chooseMetro,
  coarsen,
  metroShortCode,
  rankMetros,
  resolveMetroSlug,
  type ActiveMetro,
  type Coordinates,
  type MetroChoiceInput,
} from "./metro";

function metro(
  slug: string,
  name: string,
  latitude: number,
  longitude: number,
  upcomingEventCount: number,
  nextEventAt = "2099-01-01T00:00:00Z"
): ActiveMetro {
  return {
    slug,
    name,
    stateRegion: null,
    countryCode: "US",
    latitude,
    longitude,
    upcomingEventCount,
    nextEventAt,
  };
}

const NYC = metro("new-york-city", "New York City", 40.7128, -74.006, 18);
const BOSTON = metro("boston", "Boston", 42.3601, -71.0589, 6);
const PHILLY = metro("philadelphia", "Philadelphia", 39.9526, -75.1652, 5);
const MIAMI = metro("miami", "Miami", 25.7617, -80.1918, 8);
const ACTIVE = [NYC, BOSTON, PHILLY, MIAMI];
// Registered but with no upcoming events: never discoverable on its own.
const REGISTERED = [...ACTIVE, { slug: "los-angeles", name: "Los Angeles" }];

const NEWARK: Coordinates = { latitude: 40.7357, longitude: -74.1724 };
const CENTER_CITY_PHILLY: Coordinates = { latitude: 39.95, longitude: -75.17 };
const DENVER: Coordinates = { latitude: 39.74, longitude: -104.99 };

function input(overrides: Partial<MetroChoiceInput>): MetroChoiceInput {
  return {
    explicit: null,
    profile: null,
    stored: null,
    coords: null,
    metros: REGISTERED,
    active: ACTIVE,
    ...overrides,
  };
}

describe("chooseMetro", () => {
  it("lets a manual pick beat the profile city, the stored city, and location", () => {
    expect(
      chooseMetro(
        input({ explicit: "boston", profile: "miami", stored: "philadelphia", coords: NEWARK })
      )
    ).toEqual({ slug: "boston", source: "explicit" });
  });

  it("ranks profile over stored, and stored over location", () => {
    expect(chooseMetro(input({ profile: "miami", stored: "boston", coords: NEWARK }))).toEqual({
      slug: "miami",
      source: "profile",
    });
    expect(chooseMetro(input({ stored: "boston", coords: NEWARK }))).toEqual({
      slug: "boston",
      source: "stored",
    });
  });

  it("keeps a person's pick even when that metro has no upcoming events", () => {
    expect(chooseMetro(input({ stored: "los-angeles", coords: NEWARK }))).toEqual({
      slug: "los-angeles",
      source: "stored",
    });
  });

  it("ignores remembered slugs that are no longer registered metros", () => {
    expect(chooseMetro(input({ stored: "atlantis", coords: NEWARK }))).toEqual({
      slug: "new-york-city",
      source: "location",
    });
  });

  it("sends a visitor near a city without events to the nearest metro that has them", () => {
    // Newark itself has no metro; New York City (~15 km) does.
    expect(chooseMetro(input({ coords: NEWARK }))).toEqual({
      slug: "new-york-city",
      source: "location",
    });
  });

  it("picks Philadelphia for a Philadelphia visitor once Philadelphia has events", () => {
    expect(chooseMetro(input({ coords: CENTER_CITY_PHILLY }))).toEqual({
      slug: "philadelphia",
      source: "location",
    });
  });

  it("reports no nearby metro instead of teleporting a far-away visitor", () => {
    expect(chooseMetro(input({ coords: DENVER }))).toEqual({ slug: null, source: "none-nearby" });
  });

  it("falls back to the metro with the most upcoming events when location is unknown or denied", () => {
    expect(chooseMetro(input({}))).toEqual({ slug: "new-york-city", source: "inventory" });
  });

  it("breaks inventory ties by the soonest next event", () => {
    const early = metro("a-city", "A City", 0, 0, 3, "2099-01-01T00:00:00Z");
    const late = metro("b-city", "B City", 0, 0, 3, "2098-01-01T00:00:00Z");
    expect(chooseMetro(input({ metros: [early, late], active: [early, late] }))).toEqual({
      slug: "b-city",
      source: "inventory",
    });
  });

  it("surfaces a newly active metro with no code change", () => {
    const miamiVisitor = { latitude: 25.79, longitude: -80.13 };
    expect(chooseMetro(input({ coords: miamiVisitor }))).toEqual({
      slug: "miami",
      source: "location",
    });
    // …and once Miami has no future events it is simply absent from `active`.
    expect(chooseMetro(input({ coords: miamiVisitor, active: [NYC, BOSTON, PHILLY] }))).toEqual({
      slug: null,
      source: "none-nearby",
    });
  });

  it("chooses nothing when no metro has upcoming events", () => {
    expect(chooseMetro(input({ active: [] }))).toEqual({ slug: null, source: "none" });
  });
});

describe("rankMetros", () => {
  it("orders by distance when the visitor's area is known", () => {
    expect(rankMetros(ACTIVE, NEWARK).map((m) => m.slug)).toEqual([
      "new-york-city",
      "philadelphia",
      "boston",
      "miami",
    ]);
  });

  it("orders by inventory when it is not", () => {
    expect(rankMetros(ACTIVE, null).map((m) => m.slug)).toEqual([
      "new-york-city",
      "miami",
      "boston",
      "philadelphia",
    ]);
  });
});

describe("resolveMetroSlug", () => {
  it.each([
    ["new-york-city", "new-york-city"],
    ["NYC", "new-york-city"],
    ["New York", "new-york-city"],
    ["Brooklyn", "new-york-city"],
    ["Cambridge", "boston"],
    ["Miami", "miami"],
    ["Los Angeles", "los-angeles"],
  ])("resolves %s to %s", (value, expected) => {
    expect(resolveMetroSlug(value, REGISTERED)).toBe(expected);
  });

  it("does not invent metros that are not registered", () => {
    expect(resolveMetroSlug("Atlantis", REGISTERED)).toBeNull();
    expect(resolveMetroSlug("NYC", [BOSTON])).toBeNull();
  });
});

describe("metroShortCode", () => {
  it.each([
    ["New York City", "NYC"],
    ["Boston", "BOS"],
    ["Los Angeles", "LA"],
    ["Philadelphia", "PHI"],
  ])("%s → %s", (name, code) => {
    expect(metroShortCode(name)).toBe(code);
  });
});

describe("coarsen", () => {
  it("rounds a position to about 11 km before use", () => {
    expect(coarsen({ latitude: 40.748817, longitude: -73.985428 })).toEqual({
      latitude: 40.7,
      longitude: -74,
    });
  });
});
