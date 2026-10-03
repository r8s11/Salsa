import { describe, expect, it } from "vitest";
import { parseFlyerExtraction } from "./types";

describe("flyer extraction validation", () => {
  it("normalizes a complete extraction", () => {
    expect(
      parseFlyerExtraction({
        title: "  Friday Salsa  ",
        date: "2026-09-18",
        start_time: "19:00",
        end_time: null,
        venue_name: "Dance Hall",
        address: "1 Main St",
        city: "Boston",
        dance_styles: ["Salsa", " salsa ", "Bachata"],
        event_type: "Social",
        price: "$20",
        organizer_name: "Salsa Segura",
        instagram: "@salsasegura",
        website: "https://example.com",
        details: [" Doors at 7 PM ", ""],
      })
    ).toEqual({
      title: "Friday Salsa",
      date: "2026-09-18",
      start_time: "19:00",
      end_time: null,
      venue_name: "Dance Hall",
      address: "1 Main St",
      city: "Boston",
      dance_styles: ["Salsa", "Bachata"],
      event_type: "Social",
      price: "$20",
      organizer_name: "Salsa Segura",
      instagram: "@salsasegura",
      website: "https://example.com",
      details: ["Doors at 7 PM"],
    });
  });

  it("accepts partial nullable data and rejects malformed fields", () => {
    expect(parseFlyerExtraction({ title: "Only a title" }).title).toBe("Only a title");
    expect(() => parseFlyerExtraction({ title: 42 })).toThrow("Invalid flyer extraction");
    expect(() => parseFlyerExtraction(null)).toThrow("Invalid flyer extraction");
  });

  it("drops invalid URLs and bounds excessive text", () => {
    const parsed = parseFlyerExtraction({
      website: "javascript:alert(1)",
      instagram: "x".repeat(600),
      details: ["same", "same", "x".repeat(600)],
    });
    expect(parsed.website).toBeNull();
    expect(parsed.instagram).toHaveLength(500);
    expect(parsed.details).toEqual(["same", "x".repeat(500)]);
  });

  it("keeps a scheme-less domain by assuming https", () => {
    expect(parseFlyerExtraction({ website: "salsasegura.com" }).website).toBe(
      "https://salsasegura.com"
    );
    expect(parseFlyerExtraction({ website: "www.salsasegura.com/events" }).website).toBe(
      "https://www.salsasegura.com/events"
    );
    expect(parseFlyerExtraction({ website: "https://example.com" }).website).toBe(
      "https://example.com"
    );
    expect(parseFlyerExtraction({ website: "ask at the door" }).website).toBeNull();
  });

  it("keeps the readable fields when a date or time is unparseable", () => {
    const parsed = parseFlyerExtraction({
      title: "Friday Salsa",
      date: "next Friday",
      start_time: "9pm",
      end_time: "22:30",
      venue_name: "Dance Hall",
    });
    expect(parsed.date).toBeNull();
    expect(parsed.start_time).toBeNull();
    expect(parsed.end_time).toBe("22:30");
    expect(parsed.title).toBe("Friday Salsa");
    expect(parsed.venue_name).toBe("Dance Hall");
  });
});

describe("structured entity extraction parsing", () => {
  const entity = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    address: null,
    city: null,
    state_region: null,
    country: null,
    website: null,
    instagram: null,
    email: null,
    phone: null,
    organization: null,
    ...extra,
  });

  it("parses venue, organizer, instructors and school with normalized contacts", () => {
    const parsed = parseFlyerExtraction({
      title: "Friday Salsa",
      venue: entity("  Havana Club ", { address: "288 Green St", city: "Cambridge", state_region: "MA" }),
      organizer: entity("Salsa Segura", { instagram: "https://instagram.com/salsasegura/", website: "salsasegura.com" }),
      instructors: [entity("Ana Rivera", { organization: "Mambo Co" }), entity("ana rivera", { organization: "Mambo Co" }), entity("Luis")],
      school: entity("Mambo Co", { email: "info@mambo.example", phone: "617-555-0100" }),
    });
    expect(parsed.venue).toMatchObject({ name: "Havana Club", city: "Cambridge", state_region: "MA" });
    expect(parsed.organizer).toMatchObject({
      name: "Salsa Segura",
      instagram: "@salsasegura",
      website: "https://salsasegura.com",
    });
    expect(parsed.instructors?.map((entry) => entry.name)).toEqual(["Ana Rivera", "Luis"]);
    expect(parsed.instructors?.[0].organization).toBe("Mambo Co");
    expect(parsed.school).toMatchObject({ email: "info@mambo.example", phone: "617-555-0100" });
  });

  it("always emits all four structured fields once any is present", () => {
    const parsed = parseFlyerExtraction({ title: "T", venue: entity("Havana Club") });
    expect(parsed.organizer).toBeNull();
    expect(parsed.school).toBeNull();
    expect(parsed.instructors).toEqual([]);
  });

  it("leaves structured fields absent for a legacy flat payload", () => {
    const parsed = parseFlyerExtraction({ title: "Legacy", venue_name: "Hall" });
    expect(parsed).not.toHaveProperty("venue");
    expect(parsed).not.toHaveProperty("instructors");
  });

  it("drops nameless entities and bounds the instructor list", () => {
    const parsed = parseFlyerExtraction({
      venue: entity("   "),
      instructors: [
        entity(""),
        ...Array.from({ length: 40 }, (_, index) => entity(`Teacher ${index}`)),
      ],
    });
    expect(parsed.venue).toBeNull();
    expect(parsed.instructors).toHaveLength(10);
  });

  it("rejects structurally wrong entity payloads", () => {
    expect(() => parseFlyerExtraction({ venue: "Havana Club" })).toThrow("Invalid flyer extraction");
    expect(() => parseFlyerExtraction({ instructors: "Ana" })).toThrow("Invalid flyer extraction");
    expect(() => parseFlyerExtraction({ school: ["x"] })).toThrow("Invalid flyer extraction");
    expect(() => parseFlyerExtraction({ instructors: ["Ana"] })).toThrow("Invalid flyer extraction");
  });

  it("never copies the flat event contact onto an entity", () => {
    const parsed = parseFlyerExtraction({
      instagram: "@eventcontact",
      website: "https://eventcontact.example",
      organizer: entity("Salsa Segura"),
    });
    expect(parsed.organizer?.instagram).toBeNull();
    expect(parsed.organizer?.website).toBeNull();
  });
});
