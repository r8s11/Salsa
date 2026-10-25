import { supabase } from "../../lib/supabase";
import { parseFlyerExtraction, type ExtractFlyerResponse, type ExtractedEvent } from "./types";

export async function extractEventFromFlyer(imageUrl: string): Promise<ExtractedEvent> {
  if (!imageUrl.trim()) throw new Error("No flyer image to analyze.");

  const { data, error } = await supabase.functions.invoke<unknown>("extract-flyer", {
    body: { imageUrl },
  });
  if (error || !data || typeof data !== "object" || !("extraction" in data)) {
    throw new Error("We couldn't read this flyer. Please try again.");
  }

  try {
    return parseFlyerExtraction((data as ExtractFlyerResponse).extraction);
  } catch {
    throw new Error("We couldn't read this flyer. Please try again.");
  }
}
