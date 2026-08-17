import type { DatabaseEvent } from "../../events/model/types";
import type { CsvRowResult } from "./csvImportValidation";

export type CsvDuplicateSignal = "same-venue" | "same-date" | "similar-title" | "same-organizer";

export interface CsvDuplicateMatch {
  event: DatabaseEvent;
  signals: CsvDuplicateSignal[];
  confidence: "high" | "medium";
}

/**
 * Same signal-scoring pattern as duplicates.ts's detectDuplicates (title /
 * date / venue / host, 2+ signals = a match, 3+ = high confidence) —
 * ported rather than shared, since that function is coupled to the
 * EventSubmission shape via getEffectiveEventData and is already shipped,
 * tested code. A CSV row's payload is different enough (AdminEventPayload,
 * not a submission) that forking this ~20-line comparison is lower-risk
 * than refactoring a shared core out from under existing behavior.
 */
export function findCsvRowDuplicates(
  row: CsvRowResult,
  candidates: DatabaseEvent[]
): CsvDuplicateMatch[] {
  if (!row.payload) return [];
  const { title, event_date, location, host } = row.payload;
  const matches: CsvDuplicateMatch[] = [];

  for (const event of candidates) {
    const signals: CsvDuplicateSignal[] = [];

    if (location && location.trim().toLowerCase() === (event.location ?? "").trim().toLowerCase()) {
      signals.push("same-venue");
    }
    if (event_date.split("T")[0] === event.event_date.split("T")[0]) {
      signals.push("same-date");
    }
    if (title.trim().toLowerCase() === event.title.trim().toLowerCase()) {
      signals.push("similar-title");
    }
    if (host && host.trim().toLowerCase() === (event.host ?? "").trim().toLowerCase()) {
      signals.push("same-organizer");
    }

    if (signals.length >= 2) {
      matches.push({ event, signals, confidence: signals.length >= 3 ? "high" : "medium" });
    }
  }

  return matches;
}
