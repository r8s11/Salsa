import { EventSubmission, DuplicateSignal, DuplicateCandidate } from "./submissions";
import { DatabaseEvent } from "../../events/model/types";
import { getEffectiveEventData } from "./submissionForm";

export function detectDuplicates(
  submission: EventSubmission,
  candidates: DatabaseEvent[]
): DuplicateCandidate[] {
  const submissionData = getEffectiveEventData(submission);
  const detected: DuplicateCandidate[] = [];

  for (const event of candidates) {
    const signals: DuplicateSignal[] = [];

    // same-venue
    if (
      (submissionData.location as string)?.trim().toLowerCase() === 
      event.location?.trim().toLowerCase() && 
      (submissionData.location as string)?.trim().length > 0
    ) {
      signals.push('same-venue');
    }

    // same-date
    if (
      (submissionData.event_date as string)?.split('T')[0] === 
      event.event_date.split('T')[0]
    ) {
      signals.push('same-date');
    }

    // similar-title
    if (
      (submissionData.title as string)?.trim().toLowerCase() === 
      event.title.trim().toLowerCase()
    ) {
      signals.push('similar-title');
    }

    // same-organizer
    if (
      (submissionData.host as string)?.trim().toLowerCase() === 
      event.host?.trim().toLowerCase() &&
      (submissionData.host as string)?.trim().length > 0
    ) {
      signals.push('same-organizer');
    }

    if (signals.length >= 2) {
      detected.push({
        event,
        signals,
        confidence: signals.length >= 3 ? 'high' : 'medium',
      });
    }
  }

  return detected;
}
