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
