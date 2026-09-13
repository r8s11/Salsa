export type ReconciliationStatus = "exact" | "strong" | "ambiguous" | "none";

export type VenueMatch = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
};

export type ReconciliationResponse = {
  venue: {
    status: ReconciliationStatus;
    match: VenueMatch | null;
  };
};

export type ReconciliationRequest = {
  venue: {
    name: string | null;
    address: string | null;
    city: string | null;
  };
};

/**
 * Validates and normalizes a reconciliation response from the backend.
 * Defensive parsing: converts parse failures to catchable errors.
 */
export function parseReconciliationResponse(raw: unknown): ReconciliationResponse {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid reconciliation response structure");
  }

  const source = raw as Record<string, unknown>;

  // Check top-level structure
  if (!("venue" in source)) {
    throw new Error("Invalid reconciliation response structure");
  }

  const venue = source.venue;
  if (!venue || typeof venue !== "object" || Array.isArray(venue)) {
    throw new Error("Invalid reconciliation response structure");
  }

  const venueObj = venue as Record<string, unknown>;

  // Validate status field
  if (!("status" in venueObj) || typeof venueObj.status !== "string") {
    throw new Error("Invalid reconciliation response: missing or invalid status");
  }

  const status = venueObj.status as string;
  if (!["exact", "strong", "ambiguous", "none"].includes(status)) {
    throw new Error("Invalid reconciliation response: invalid status value");
  }

  // Validate match field
  let match: VenueMatch | null = null;
  if ("match" in venueObj && venueObj.match !== null) {
    if (!venueObj.match || typeof venueObj.match !== "object" || Array.isArray(venueObj.match)) {
      throw new Error("Invalid reconciliation response: invalid match structure");
    }

    const matchObj = venueObj.match as Record<string, unknown>;

    // Validate required match fields
    if (typeof matchObj.id !== "string" || !matchObj.id) {
      throw new Error("Invalid reconciliation response: match missing id");
    }
    if (typeof matchObj.name !== "string" || !matchObj.name) {
      throw new Error("Invalid reconciliation response: match missing name");
    }

    // Validate optional match fields
    if (matchObj.address !== null && matchObj.address !== undefined && typeof matchObj.address !== "string") {
      throw new Error("Invalid reconciliation response: invalid address type");
    }
    if (matchObj.city !== null && matchObj.city !== undefined && typeof matchObj.city !== "string") {
      throw new Error("Invalid reconciliation response: invalid city type");
    }

    match = {
      id: matchObj.id,
      name: matchObj.name,
      address: (matchObj.address as string | null) ?? null,
      city: (matchObj.city as string | null) ?? null,
    };
  }

  return {
    venue: {
      status: status as ReconciliationStatus,
      match,
    },
  };
}
