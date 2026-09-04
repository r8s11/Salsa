/**
 * User-facing error copy for public forms.
 *
 * Callers used to write `err instanceof Error ? err.message : "Unknown error"`,
 * which has two failure modes the P2-4 audit reproduced live: a Supabase
 * `PostgrestError` is a plain object, so its message was discarded and the user
 * saw "Unknown error"; and a bare `TypeError` from `fetch` leaked the browser's
 * "Failed to fetch" straight into the UI. This helper always produces copy the
 * reader can act on, and never a raw object dump.
 */

export interface PublicErrorOptions {
  /** Copy shown when nothing safer can be derived. Must be actionable. */
  fallback: string;
  /** Copy for a failed network round-trip; defaults to a connection hint. */
  networkFallback?: string;
}

/**
 * Messages that are technically accurate but useless (or alarming) to a
 * visitor. They are treated as "no usable message" so the caller's fallback
 * wins.
 */
const OPAQUE_MESSAGE = /^(failed to fetch|load failed|network ?error|networkerror when attempting to fetch resource\.?|unknown error|error|fetch failed)$/i;

/** Internals that must never reach a public form. */
const INTERNAL_LEAK =
  /(row-level security|violates|constraint|permission denied|pgrst|jwt|supabase|postgres|sql|stack|undefined is not|null value in column|duplicate key)/i;

function readMessage(error: unknown): string | null {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error;
    if (typeof message === "string") return message;
  }
  return null;
}

/**
 * True when the failure looks like the request never reached the service:
 * `TypeError` from `fetch`, or one of the browser-specific network strings.
 */
export function isNetworkError(error: unknown): boolean {
  const message = readMessage(error) ?? "";
  return (
    error instanceof TypeError ||
    /failed to fetch|load failed|network ?error|fetch failed|networkerror/i.test(message)
  );
}

export function publicErrorMessage(error: unknown, options: PublicErrorOptions): string {
  const { fallback, networkFallback } = options;

  if (isNetworkError(error)) {
    return networkFallback ?? "We couldn't reach the server. Check your connection and try again.";
  }

  const message = readMessage(error)?.trim() ?? "";
  if (!message || OPAQUE_MESSAGE.test(message) || INTERNAL_LEAK.test(message)) {
    return fallback;
  }

  return message;
}
