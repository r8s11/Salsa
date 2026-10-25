/**
 * Short event links: `/e/<code>` where the code is the first eight hex digits
 * of the event's UUID. Printed on shared posters, where a full
 * `/events/<uuid>` URL is too long to read or type.
 *
 * The code is not unique by construction, so resolution queries the id range
 * the prefix covers and treats more than one match as ambiguous rather than
 * guessing.
 */

const CODE_LENGTH = 8;
const CODE_PATTERN = /^[0-9a-f]{8}$/;

export function shortEventCode(eventId: string): string | null {
  const code = eventId.replace(/-/g, "").slice(0, CODE_LENGTH).toLowerCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function normalizeShortEventCode(raw: string | undefined): string | null {
  const code = raw?.trim().toLowerCase() ?? "";
  return CODE_PATTERN.test(code) ? code : null;
}

/** Inclusive UUID bounds covering every id that starts with `code`. */
export function shortCodeIdRange(code: string): { from: string; to: string } {
  return {
    from: `${code}-0000-0000-0000-000000000000`,
    to: `${code}-ffff-ffff-ffff-ffffffffffff`,
  };
}

function origin(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof window === "undefined") {
    throw new Error("A public origin is required outside the browser.");
  }
  return window.location.origin;
}

/**
 * Full short URL for sharing and QR codes. Falls back to the canonical
 * `/events/<id>` URL when the id is not a UUID (fixtures, legacy ids).
 */
export function buildShortEventUrl(eventId: string, explicitOrigin?: string): string {
  const code = shortEventCode(eventId);
  const path = code ? `/e/${code}` : `/events/${encodeURIComponent(eventId)}`;
  return new URL(path, origin(explicitOrigin)).toString();
}

/** The short URL as printed: host and path, no scheme. */
export function shortEventLabel(eventId: string, explicitOrigin?: string): string {
  const url = new URL(buildShortEventUrl(eventId, explicitOrigin));
  return `${url.host}${url.pathname}`;
}
