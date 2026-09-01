import type { UserRole } from "../contexts/authContextObject";

export function resolveAuthorizedDestination(role: UserRole | null): string {
  if (role === "organizer") {
    return "/host";
  }
  if (role === "admin" || role === "moderator") {
    return "/admin";
  }
  return "/profile";
}

/**
 * Callback-route destination: prefer a caller-supplied `next` path when it's
 * a safe internal path (see `isSafeInternalPath`), otherwise fall back to the
 * role-appropriate default. Reused by /auth/callback today; the same rule
 * applies to any future auth-completion route (e.g. Founder invitation
 * acceptance) so redirect handling never needs to be re-invented per flow.
 */
export function resolveCallbackDestination(role: UserRole | null, next: unknown): string {
  if (isSafeInternalPath(next)) {
    return next;
  }
  return resolveAuthorizedDestination(role);
}

export function isSafeInternalPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("\\\\")) {
    return false;
  }
  if (value.includes("://")) {
    return false;
  }
  return true;
}
