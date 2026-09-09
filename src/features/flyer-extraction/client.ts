import { supabase } from "../../lib/supabase";
import {
  type ExtractedEvent,
  validateExtractedEvent,
} from "./types";

export type ExtractFlyerResult = ExtractedEvent;

interface ExtractFlyerRequest {
  /** Public (or signed) URL of an already-uploaded flyer image. */
  imageUrl: string;
}

/**
 * Extract structured event information from an uploaded flyer.
 *
 * This is the ONLY provider-facing call the React UI makes — it POSTs the
 * flyer URL to the `extract-flyer` Supabase Edge Function, which holds the AI
 * key server-side and returns a validated {@link ExtractedEvent}. The UI never
 * sees provider-specific logic or secrets.
 *
 * @throws Error with a human-readable message when the request fails or the
 *   function returns no data. The caller decides how to present failure.
 */
export async function extractEventFromFlyer(imageUrl: string): Promise<ExtractFlyerResult> {
  if (!imageUrl) {
    throw new Error("No flyer image to analyze.");
  }

  const { data, error } = await supabase.functions.invoke<unknown>("extract-flyer", {
    body: { imageUrl } satisfies ExtractFlyerRequest,
  });

  if (error) {
    throw new Error(error.message || "We couldn't reach the flyer analysis service.");
  }

  if (data === null || data === undefined) {
    throw new Error("The flyer analysis service returned no result.");
  }

  // Validate/normalize before anything is displayed — never trust raw model
  // output to be well-typed or free of injected markup.
  return validateExtractedEvent(data);
}
