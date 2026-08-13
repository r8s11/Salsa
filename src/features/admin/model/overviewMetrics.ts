import type { DatabaseEvent } from "../../events/model/types";
import type { AdminUserRow } from "../model/usersQuery";

export const UPCOMING_WINDOW_DAYS = 30;
export const UPCOMING_LIST_LIMIT = 8;

export type MissingField = "venue" | "time" | "image";

export interface OverviewMetrics {
  upcomingCount: number;
  pendingCount: number;
  submissionCount: number;
  incompleteCount: number;
  organizerRequestCount: number;
  flaggedUserCount: number;
  totalCount: number;
}

function daysFromNow(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function missingFields(event: DatabaseEvent): MissingField[] {
  const missing: MissingField[] = [];
  if (!event.location?.trim()) missing.push("venue");
  if (!event.event_time?.trim()) missing.push("time");
  if (!event.image_url?.trim()) missing.push("image");
  return missing;
}

export function deriveOverviewMetrics(
  events: DatabaseEvent[],
  now: Date,
  submissionCount: number = 0,
  pendingSubmissionCount: number = 0,
  users: AdminUserRow[] = [],
  organizerRequestCount: number = 0
): OverviewMetrics {
  return {
    upcomingCount: deriveUpcomingEvents(events, now).length,
    pendingCount: pendingSubmissionCount,
    submissionCount,
    incompleteCount: deriveIncompleteEvents(events, now).length,
    organizerRequestCount,
    flaggedUserCount: users.filter((u) => u.flagged).length,
    totalCount: events.length,
  };
}

export function deriveUpcomingEvents(events: DatabaseEvent[], now: Date): DatabaseEvent[] {
  return events
    .filter((event) => event.status === "approved" && new Date(event.event_date) >= now)
    .sort((a, b) => Date.parse(a.event_date) - Date.parse(b.event_date))
    .slice(0, UPCOMING_LIST_LIMIT);
}

export function deriveIncompleteEvents(
  events: DatabaseEvent[],
  now: Date
): { event: DatabaseEvent; missing: MissingField[] }[] {
  return events
    .filter((event) => event.status === "approved" && new Date(event.event_date) >= now)
    .map((event) => ({ event, missing: missingFields(event) }))
    .filter(({ missing }) => missing.length > 0);
}

export type QualityIssue = "venue" | "time" | "image" | "organizer" | "description" | "pricing" | "duplicate";

export const QUALITY_ISSUE_LABEL: Record<QualityIssue, string> = {
  venue: "Missing venue",
  time: "Missing start time",
  image: "Missing flyer",
  organizer: "Missing organizer",
  description: "No description",
  pricing: "Missing pricing",
  duplicate: "Potential duplicate",
};

export function qualityIssues(event: DatabaseEvent, duplicateIds?: ReadonlySet<string>): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (!event.location?.trim()) issues.push("venue");
  if (!event.event_time?.trim()) issues.push("time");
  if (!event.image_url?.trim()) issues.push("image");
  if (!event.host?.trim()) issues.push("organizer");
  if (!event.description?.trim()) issues.push("description");
  if (event.price_type === null) issues.push("pricing");
  if (duplicateIds?.has(event.id)) issues.push("duplicate");
  return issues;
}

// Flags both members of any pair sharing a case-insensitive trimmed title
// AND location, whose event_date values are within +-24h. A weekly event
// duplicated to next week is 7 days out and correctly not flagged; the same
// event entered twice for one night is.
export function findPotentialDuplicates(events: DatabaseEvent[]): Set<string> {
  const duplicates = new Set<string>();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const key = (event: DatabaseEvent) =>
    `${event.title.trim().toLowerCase()}\u0000${(event.location ?? "").trim().toLowerCase()}`;

  const byKey = new Map<string, DatabaseEvent[]>();
  for (const event of events) {
    const k = key(event);
    const bucket = byKey.get(k);
    if (bucket) bucket.push(event);
    else byKey.set(k, [event]);
  }

  for (const bucket of byKey.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const diff = Math.abs(Date.parse(bucket[i].event_date) - Date.parse(bucket[j].event_date));
        if (diff <= DAY_MS) {
          duplicates.add(bucket[i].id);
          duplicates.add(bucket[j].id);
        }
      }
    }
  }

  return duplicates;
}
