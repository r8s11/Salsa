import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileVenue } from "./reconcileClient";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("../../lib/supabase", () => ({
  supabase: { functions: { invoke } },
}));

describe("reconcileVenue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls reconcile-flyer with trimmed venue data", async () => {
    invoke.mockResolvedValue({
      data: { venue: { status: "exact", match: { id: "1", name: "Club", address: null, city: null } } },
      error: null,
    });

    await reconcileVenue({
      venue: {
        name: "  Havana Club  ",
        address: "  288 Green Street  ",
        city: "  Cambridge  ",
      },
    });

    expect(invoke).toHaveBeenCalledWith("reconcile-flyer", {
      body: {
        venue: {
          name: "Havana Club",
          address: "288 Green Street",
          city: "Cambridge",
        },
      },
    });
  });

  it("sends null for empty strings", async () => {
    invoke.mockResolvedValue({
      data: { venue: { status: "none", match: null } },
      error: null,
    });

    await reconcileVenue({
      venue: {
        name: "Club Name",
        address: "   ",
        city: "",
      },
    });

    expect(invoke).toHaveBeenCalledWith("reconcile-flyer", {
      body: {
        venue: {
          name: "Club Name",
          address: null,
          city: null,
        },
      },
    });
  });

  it("returns validated reconciliation response on success", async () => {
    invoke.mockResolvedValue({
      data: {
        venue: {
          status: "strong",
          match: {
            id: "venue-456",
            name: "The Dance Hall",
            address: "42 Main Street",
            city: "Boston",
          },
        },
      },
      error: null,
    });

    const result = await reconcileVenue({
      venue: {
        name: "Dance Hall",
        address: "42 Main St",
        city: "Boston",
      },
    });

    expect(result).toEqual({
      venue: {
        status: "strong",
        match: {
          id: "venue-456",
          name: "The Dance Hall",
          address: "42 Main Street",
          city: "Boston",
        },
      },
    });
  });

  it("handles 'none' status with null match", async () => {
    invoke.mockResolvedValue({
      data: {
        venue: {
          status: "none",
          match: null,
        },
      },
      error: null,
    });

    const result = await reconcileVenue({
      venue: {
        name: "Unknown Venue",
        address: null,
        city: null,
      },
    });

    expect(result.venue.status).toBe("none");
    expect(result.venue.match).toBeNull();
  });

  it("rejects when all venue fields are empty/whitespace", async () => {
    await expect(
      reconcileVenue({
        venue: {
          name: "   ",
          address: "\t",
          city: "",
        },
      })
    ).rejects.toThrow("Please provide a venue name, address, or city to reconcile.");

    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects when all venue fields are null", async () => {
    await expect(
      reconcileVenue({
        venue: {
          name: null,
          address: null,
          city: null,
        },
      })
    ).rejects.toThrow("Please provide a venue name, address, or city to reconcile.");

    expect(invoke).not.toHaveBeenCalled();
  });

  it("translates invocation errors to safe user-facing message", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: "Database connection failed: secret leaked" },
    });

    await expect(
      reconcileVenue({
        venue: {
          name: "Club",
          address: null,
          city: null,
        },
      })
    ).rejects.toThrow("We couldn't verify this venue. Please try again.");
  });

  it("translates null data to safe error", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      reconcileVenue({
        venue: {
          name: "Club",
          address: null,
          city: null,
        },
      })
    ).rejects.toThrow("We couldn't verify this venue. Please try again.");
  });

  it("translates non-object data to safe error", async () => {
    invoke.mockResolvedValue({
      data: "not an object",
      error: null,
    });

    await expect(
      reconcileVenue({
        venue: {
          name: "Club",
          address: null,
          city: null,
        },
      })
    ).rejects.toThrow("We couldn't verify this venue. Please try again.");
  });

  it("translates parse failures to safe error", async () => {
    invoke.mockResolvedValue({
      data: {
        venue: {
          status: "exact",
          match: { id: "1", name: "Club", address: 123, city: null }, // invalid address type
        },
      },
      error: null,
    });

    await expect(
      reconcileVenue({
        venue: {
          name: "Club",
          address: null,
          city: null,
        },
      })
    ).rejects.toThrow("We couldn't verify this venue. Please try again.");
  });

  it("preserves null fields in request", async () => {
    invoke.mockResolvedValue({
      data: { venue: { status: "none", match: null } },
      error: null,
    });

    await reconcileVenue({
      venue: {
        name: null,
        address: "123 Street",
        city: null,
      },
    });

    expect(invoke).toHaveBeenCalledWith("reconcile-flyer", {
      body: {
        venue: {
          name: null,
          address: "123 Street",
          city: null,
        },
      },
    });
  });
});
