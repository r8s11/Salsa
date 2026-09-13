import { supabase } from "../../lib/supabase";
import { parseReconciliationResponse, type ReconciliationResponse, type ReconciliationRequest } from "./types";

export async function reconcileVenue(request: ReconciliationRequest): Promise<ReconciliationResponse> {
  // Validate input: at least one field should have a value
  const { venue } = request;
  if (!venue.name?.trim() && !venue.address?.trim() && !venue.city?.trim()) {
    throw new Error("Please provide a venue name, address, or city to reconcile.");
  }

  const { data, error } = await supabase.functions.invoke<unknown>("reconcile-flyer", {
    body: {
      venue: {
        name: venue.name?.trim() || null,
        address: venue.address?.trim() || null,
        city: venue.city?.trim() || null,
      },
    },
  });

  if (error || !data || typeof data !== "object") {
    throw new Error("We couldn't verify this venue. Please try again.");
  }

  try {
    return parseReconciliationResponse(data);
  } catch {
    throw new Error("We couldn't verify this venue. Please try again.");
  }
}
