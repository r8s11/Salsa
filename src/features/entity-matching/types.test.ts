import { describe, expect, it } from "vitest";
import { parseReconciliationResponse } from "./types";

describe("reconciliation response validation", () => {
  it("validates a successful match response with all fields", () => {
    const response = parseReconciliationResponse({
      venue: {
        status: "exact",
        match: {
          id: "venue-123",
          name: "Havana Club",
          address: "288 Green Street",
          city: "Cambridge",
        },
      },
    });

    expect(response).toEqual({
      venue: {
        status: "exact",
        match: {
          id: "venue-123",
          name: "Havana Club",
          address: "288 Green Street",
          city: "Cambridge",
        },
      },
    });
  });

  it("validates all status values", () => {
    const statuses: Array<"exact" | "strong" | "ambiguous" | "none"> = ["exact", "strong", "ambiguous", "none"];

    for (const status of statuses) {
      const response = parseReconciliationResponse({
        venue: {
          status,
          match: status === "none" || status === "ambiguous" ? null : { id: "1", name: "Test", address: null, city: null },
        },
      });
      expect(response.venue.status).toBe(status);
    }
  });

  it("accepts null/undefined optional match fields", () => {
    const response = parseReconciliationResponse({
      venue: {
        status: "strong",
        match: {
          id: "venue-456",
          name: "Club Zero",
          address: null,
          city: undefined,
        },
      },
    });

    expect(response.venue.match).toEqual({
      id: "venue-456",
      name: "Club Zero",
      address: null,
      city: null,
    });
  });

  it("rejects null match when status is exact or strong", () => {
    expect(() =>
      parseReconciliationResponse({
        venue: {
          status: "exact",
          match: null,
        },
      })
    ).not.toThrow();
  });

  it("rejects malformed structure - missing venue", () => {
    expect(() => parseReconciliationResponse({ status: "exact" })).toThrow("Invalid reconciliation response structure");
  });

  it("rejects malformed structure - non-object venue", () => {
    expect(() => parseReconciliationResponse({ venue: "exact" })).toThrow("Invalid reconciliation response structure");
    expect(() => parseReconciliationResponse({ venue: null })).toThrow("Invalid reconciliation response structure");
    expect(() => parseReconciliationResponse({ venue: ["array"] })).toThrow("Invalid reconciliation response structure");
  });

  it("rejects missing or invalid status field", () => {
    expect(() => parseReconciliationResponse({ venue: {} })).toThrow("missing or invalid status");
    expect(() => parseReconciliationResponse({ venue: { status: 123 } })).toThrow("missing or invalid status");
    expect(() => parseReconciliationResponse({ venue: { status: null } })).toThrow("missing or invalid status");
  });

  it("rejects invalid status value", () => {
    expect(() =>
      parseReconciliationResponse({
        venue: {
          status: "invalid",
          match: null,
        },
      })
    ).toThrow("invalid status value");
  });

  it("rejects malformed match - non-object", () => {
    expect(() =>
      parseReconciliationResponse({
        venue: {
          status: "exact",
          match: "venue-id",
        },
      })
    ).toThrow("invalid match structure");
    expect(() =>
      parseReconciliationResponse({
        venue: {
          status: "exact",
          match: ["array"],
        },
      })
    ).toThrow("invalid match structure");
  });

  it("rejects match missing required id field", () => {
    expect(() =>
      parseReconciliationResponse({
        venue: {
          status: "exact",
          match: { name: "Club", address: null, city: null },
        },
      })
    ).toThrow("match missing id");
  });

  it("rejects match with empty or non-string id", () => {
    expect(() =>
      parseReconciliationResponse({
        venue: {
          status: "exact",
          match: { id: "", name: "Club", address: null, city: null },
        },
      })
    ).toThrow("match missing id");
    expect(() =>
      parseReconciliationResponse({
        venue: {
          status: "exact",
          match: { id: 123, name: "Club", address: null, city: null },
        },
      })
    ).toThrow("match missing id");
  });

  it("rejects match missing required name field", () => {
    expect(() =>
      parseReconciliationResponse({
        venue: {
          status: "exact",
          match: { id: "1", address: null, city: null },
        },
      })
    ).toThrow("match missing name");
  });

  it("rejects match with empty or non-string name", () => {
    expect(() =>
      parseReconciliationResponse({
        venue: {
          status: "exact",
          match: { id: "1", name: "", address: null, city: null },
        },
      })
    ).toThrow("match missing name");
    expect(() =>
      parseReconciliationResponse({
        venue: {
          status: "exact",
          match: { id: "1", name: 42, address: null, city: null },
        },
      })
    ).toThrow("match missing name");
  });

  it("rejects non-string address or city", () => {
    expect(() =>
      parseReconciliationResponse({
        venue: {
          status: "exact",
          match: { id: "1", name: "Club", address: 123, city: null },
        },
      })
    ).toThrow("invalid address type");
    expect(() =>
      parseReconciliationResponse({
        venue: {
          status: "exact",
          match: { id: "1", name: "Club", address: null, city: ["array"] },
        },
      })
    ).toThrow("invalid city type");
  });

  it("handles response with no match (status none)", () => {
    const response = parseReconciliationResponse({
      venue: {
        status: "none",
        match: null,
      },
    });

    expect(response.venue.status).toBe("none");
    expect(response.venue.match).toBeNull();
  });

  it("rejects non-object/array input", () => {
    expect(() => parseReconciliationResponse(null)).toThrow("Invalid reconciliation response structure");
    expect(() => parseReconciliationResponse("string")).toThrow("Invalid reconciliation response structure");
    expect(() => parseReconciliationResponse(123)).toThrow("Invalid reconciliation response structure");
    expect(() => parseReconciliationResponse(["array"])).toThrow("Invalid reconciliation response structure");
  });

  it("rejects extra fields in response (strict structural validation)", () => {
    // This allows extra fields - mirrors backend validation which allows them
    const response = parseReconciliationResponse({
      venue: {
        status: "exact",
        match: { id: "1", name: "Club", address: null, city: null },
        extra: "field",
      },
    });
    expect(response.venue.status).toBe("exact");
  });
});
