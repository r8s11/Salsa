import { describe, expect, it } from "vitest";
import { validateCsvRow } from "./csvImportValidation";
import type { EventTaxonomyTerm } from "../../events/model/types";

const SALSA: EventTaxonomyTerm = {
  id: "term-salsa",
  name: "Salsa",
  slug: "salsa",
  category: "dance_style",
  status: "active",
};
const OUTDOOR: EventTaxonomyTerm = {
  id: "term-outdoor",
  name: "Outdoor",
  slug: "outdoor",
  category: "event_attribute",
  status: "active",
};

function row(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    title: "Salsa Social",
    event_type: "social",
    event_date: "2026-09-15",
    city: "boston",
    event_time: "20:00",
    ...overrides,
  };
}

function validate(overrides: Record<string, string> = {}) {
  return validateCsvRow(row(overrides), 0, [SALSA], [OUTDOOR]);
}

describe("validateCsvRow — required fields", () => {
  it("accepts a minimal valid row and builds a payload", () => {
    const result = validate();
    expect(result.status).toBe("valid");
    expect(result.errors).toEqual([]);
    expect(result.payload).not.toBeNull();
    expect(result.payload!.title).toBe("Salsa Social");
  });

  it("reports the spreadsheet row number (header is row 1)", () => {
    expect(validateCsvRow(row(), 0, [], []).rowNumber).toBe(2);
    expect(validateCsvRow(row(), 5, [], []).rowNumber).toBe(7);
  });

  it("rejects a missing title", () => {
    const result = validate({ title: "" });
    expect(result.status).toBe("invalid");
    expect(result.errors).toContainEqual({ field: "title", message: "Event title is required." });
    expect(result.payload).toBeNull();
  });

  it("rejects an unknown event_type", () => {
    const result = validate({ event_type: "party" });
    expect(result.errors).toContainEqual({
      field: "event_type",
      message: "Must be one of: social, class, workshop.",
    });
  });

  it("rejects an unknown city", () => {
    const result = validate({ city: "miami" });
    expect(result.errors).toContainEqual({
      field: "city",
      message: "Must be one of: boston, new-york-city.",
    });
  });
});

describe("validateCsvRow — dates and times", () => {
  it("rejects a non-ISO date", () => {
    const result = validate({ event_date: "09/15/2026" });
    expect(result.errors).toContainEqual({
      field: "event_date",
      message: "Must use YYYY-MM-DD format.",
    });
  });

  it("rejects a 12-hour time", () => {
    const result = validate({ event_time: "8:00 PM" });
    expect(result.errors).toContainEqual({
      field: "event_time",
      message: "Must use 24-hour HH:MM format.",
    });
  });

  it("rejects an out-of-range hour", () => {
    expect(validate({ event_time: "25:00" }).status).toBe("invalid");
  });

  it("accepts a blank time", () => {
    expect(validate({ event_time: "" }).status).toBe("valid");
  });

  it("converts date+time to a timezone-correct instant via the shared converter", () => {
    // 20:00 America/New_York on 2026-09-15 is EDT (UTC-4) -> 00:00Z next day.
    const result = validate({ event_date: "2026-09-15", event_time: "20:00" });
    expect(result.payload!.event_date).toBe("2026-09-16T00:00:00Z");
  });
});

describe("validateCsvRow — URLs and email", () => {
  it("rejects a non-URL rsvp_link", () => {
    const result = validate({ rsvp_link: "not a url" });
    expect(result.errors).toContainEqual({
      field: "rsvp_link",
      message: "Must be a valid http:// or https:// URL.",
    });
  });

  it("rejects a non-http protocol", () => {
    expect(validate({ rsvp_link: "ftp://example.com" }).status).toBe("invalid");
  });

  it("accepts a valid https URL", () => {
    expect(validate({ rsvp_link: "https://example.com/rsvp" }).status).toBe("valid");
  });

  it("rejects a malformed contact_email", () => {
    const result = validate({ contact_email: "nope" });
    expect(result.errors).toContainEqual({
      field: "contact_email",
      message: "Must be a valid email address.",
    });
  });

  it("rejects a malformed gallery URL and names the offending value", () => {
    const result = validate({ gallery: "https://ok.com/a.jpg; junk" });
    expect(result.errors).toContainEqual({ field: "gallery", message: "Not a valid URL: junk." });
  });
});

describe("validateCsvRow — price rules", () => {
  it("requires price_amount when price_type is paid", () => {
    const result = validate({ price_type: "paid", price_amount: "" });
    expect(result.errors).toContainEqual({
      field: "price_amount",
      message: "Required when price_type is paid.",
    });
  });

  it("rejects a non-positive price", () => {
    expect(validate({ price_type: "paid", price_amount: "0" }).status).toBe("invalid");
    expect(validate({ price_type: "paid", price_amount: "abc" }).status).toBe("invalid");
  });

  it("accepts a valid paid price", () => {
    const result = validate({ price_type: "paid", price_amount: "15" });
    expect(result.status).toBe("valid");
    expect(result.payload!.price_amount).toBe(15);
  });

  it("rejects an unknown price_type", () => {
    expect(validate({ price_type: "donation" }).status).toBe("invalid");
  });
});

describe("validateCsvRow — arrays and taxonomy", () => {
  it("resolves semicolon-separated dance style names to term ids", () => {
    const result = validate({ dance_styles: "Salsa" });
    expect(result.payload!.taxonomy_term_ids).toContain("term-salsa");
  });

  it("is case-insensitive when matching term names", () => {
    const result = validate({ dance_styles: "  sALsA  " });
    expect(result.payload!.taxonomy_term_ids).toContain("term-salsa");
  });

  it("warns (does not fail) on an unknown style and still imports the row", () => {
    const result = validate({ dance_styles: "Salsa; Kizomba" });
    expect(result.status).toBe("warning");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual({
      field: "dance_styles",
      message: "Not found, skipped: Kizomba.",
    });
    expect(result.payload!.taxonomy_term_ids).toEqual(["term-salsa"]);
  });

  it("merges dance styles and event attributes into one term id list", () => {
    const result = validate({ dance_styles: "Salsa", event_attributes: "Outdoor" });
    expect(result.payload!.taxonomy_term_ids).toEqual(["term-salsa", "term-outdoor"]);
  });

  it("rejects more than 10 dance styles", () => {
    const many = Array.from({ length: 11 }, (_, i) => `Style${i}`).join("; ");
    const result = validate({ dance_styles: many });
    expect(result.errors).toContainEqual({
      field: "dance_styles",
      message: "Up to 10 styles allowed.",
    });
  });

  it("parses a semicolon gallery list into an array", () => {
    const result = validate({ gallery: "https://a.com/1.jpg; https://a.com/2.jpg" });
    expect(result.payload!.gallery).toEqual(["https://a.com/1.jpg", "https://a.com/2.jpg"]);
  });
});

describe("validateCsvRow — recurrence and length caps", () => {
  it("accepts weekly recurrence", () => {
    expect(validate({ recurrence: "weekly" }).payload!.recurrence).toBe("weekly");
  });

  it("rejects an unsupported recurrence value", () => {
    const result = validate({ recurrence: "monthly" });
    expect(result.errors).toContainEqual({
      field: "recurrence",
      message: "Must be weekly, or blank.",
    });
  });

  it("enforces the same title cap the manual form uses", () => {
    const result = validate({ title: "x".repeat(121) });
    expect(result.errors).toContainEqual({
      field: "title",
      message: "Must be 120 characters or fewer.",
    });
  });

  it("enforces the description cap", () => {
    expect(validate({ description: "x".repeat(2001) }).status).toBe("invalid");
  });
});

describe("validateCsvRow — multiple problems", () => {
  it("collects every error on a row rather than stopping at the first", () => {
    const result = validateCsvRow(
      { title: "", event_type: "bogus", event_date: "nope", city: "mars", event_time: "99:99" },
      0,
      [],
      []
    );
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
    expect(result.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(["title", "event_type", "event_date", "city", "event_time"])
    );
  });
});
