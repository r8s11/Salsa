/**
 * Short-lived, client-only hint about which auth flow (signup confirmation vs.
 * password recovery) the user most recently initiated in this browser tab.
 *
 * Supabase's PKCE verify redirect never echoes a `type` (or any other flow
 * identifier) back to `/auth/callback` on success *or* failure — the emailed
 * link's `redirect_to` must exactly match an allow-listed URL, so no query
 * string can safely be attached to it either. This means the callback route
 * cannot tell, from the URL alone, whether an expired/invalid link came from
 * a signup confirmation or a password reset email.
 *
 * To still show flow-appropriate copy (see `AuthCallback.tsx`'s ERROR_COPY),
 * the action that *starts* a flow records a short intent hint in
 * `sessionStorage` before calling the Supabase API. The callback consumes
 * (and clears) that hint once, best-effort: if it's missing (different
 * browser/device opened the link, private browsing, etc.) the callback
 * falls back to generic copy.
 */

const INTENT_STORAGE_KEY = "salsasegura-auth-intent";

export type AuthIntentKind = "signup" | "recovery";

export type AuthIntent = {
  kind: AuthIntentKind;
  email?: string;
};

function isAuthIntent(value: unknown): value is AuthIntent {
  if (!value || typeof value !== "object") return false;
  if (!("kind" in value)) return false;
  if (value.kind !== "signup" && value.kind !== "recovery") return false;
  if ("email" in value && typeof value.email !== "string" && value.email !== undefined) return false;
  return true;
}

/** Record which flow the current tab is about to start. Best-effort; never throws. */
export function setAuthIntent(kind: AuthIntentKind, email?: string): void {
  try {
    window.sessionStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify({ kind, email }));
  } catch {
    // sessionStorage unavailable (private mode, disabled storage, SSR). The
    // callback simply falls back to generic copy — not a functional failure.
  }
}

/** Read and clear the current tab's auth intent hint. Best-effort; never throws. */
export function consumeAuthIntent(): AuthIntent | null {
  try {
    const raw = window.sessionStorage.getItem(INTENT_STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(INTENT_STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw);
    return isAuthIntent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
