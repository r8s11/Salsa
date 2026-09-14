import type { UserRole } from "../contexts/authContextObject";

/**
 * Canonical Admin direct-create route. Admin event creation is a query-param
 * view on the Admin events page (`AdminEventsPage` reads `?new=1`), not a
 * separate route, so this constant is the single source of truth for every
 * "create an event" call to action.
 */
export const ADMIN_EVENT_CREATE_PATH = "/admin/events?new=1";

/** Public moderated submission flow. */
export const PUBLIC_SUBMIT_PATH = "/submit";

/**
 * Where a "Submit/Add event" call to action should land for a given role.
 *
 * Admins create platform events directly and must never be routed through the
 * moderated submission queue. Every other role — including moderators, who
 * review submissions rather than author events — keeps the public flow.
 * Organizers retain the public flow here; their dedicated create route lives
 * behind the Host dashboard, where per-organizer create capability is known.
 */
export function resolveEventCreateDestination(role: UserRole | null): string {
  return role === "admin" ? ADMIN_EVENT_CREATE_PATH : PUBLIC_SUBMIT_PATH;
}
