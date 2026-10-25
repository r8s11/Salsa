import type { DatabaseEvent } from "./types";

export const RECENTLY_APPROVED_WINDOW_MS = 72 * 60 * 60 * 1000;

type RecentlyApprovedEvent = {
  createdAt?: string | null;
  sourceType?: DatabaseEvent["source_type"] | null;
};

/**
 * Returns whether an event was published by the moderator approval workflow
 * within the initial 72-hour discovery window.
 */
export function isRecentlyApproved(
  event: RecentlyApprovedEvent,
  now: Date | number = Date.now()
): boolean {
  if (event.sourceType !== "moderator") return false;

  const approvedAt = Date.parse(event.createdAt ?? "");
  const nowMs = now instanceof Date ? now.getTime() : now;

  if (!Number.isFinite(approvedAt) || !Number.isFinite(nowMs)) return false;

  const age = nowMs - approvedAt;
  return age >= 0 && age < RECENTLY_APPROVED_WINDOW_MS;
}
