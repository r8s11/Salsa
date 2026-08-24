import { EventSubmission } from "./submissions";
import { DatabaseEvent } from "../../events/model/types";
import { getEffectiveEventData } from "./submissionForm";

export interface VenueMatch {
  match: "exact" | "fuzzy";
  existingEvent: DatabaseEvent;
}

export function findVenueMatch(
  submission: EventSubmission,
  existingEvents: DatabaseEvent[]
): VenueMatch | null {
  const submissionData = getEffectiveEventData(submission);
  const location = (submissionData.location as string)?.trim().toLowerCase();

  if (!location) return null;

  for (const event of existingEvents) {
    const existingLocation = event.location?.trim().toLowerCase();
    if (!existingLocation) continue;

    if (location === existingLocation) {
      return { match: "exact", existingEvent: event };
    }

    // Jaccard similarity > 0.6
    if (jaccardSimilarity(location, existingLocation) > 0.6) {
      return { match: "fuzzy", existingEvent: event };
    }
  }

  return null;
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/));
  const setB = new Set(b.split(/\s+/));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}
