import { createClient } from "@supabase/supabase-js";

// Get environment variables. Fail fast instead of silently creating a client
// with placeholder credentials that produce cryptic runtime errors later.
const supabaseURLValue = import.meta.env.VITE_SUPABASE_URL;
const supabaseDefaultKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseURLValue || !supabaseDefaultKey) {
  throw new Error(
    "Missing required Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY."
  );
}

export const supabaseURL: string = supabaseURLValue;
// Match Supabase's default namespace explicitly so deleted-account cleanup can
// remove only this app's persisted session without changing existing sessions.
export const supabaseAuthStorageKey = `sb-${new URL(supabaseURL).hostname.split(".")[0]}-auth-token`;

// Create and export Supabase client.
// flowType "pkce" makes email-confirmation and password-recovery returns
// arrive at /auth/callback with a ?code= param exchanged via
// exchangeCodeForSession(); /auth/invite handles its own invite links the
// same way.
//
// detectSessionInUrl is deliberately OFF: both callback routes already do
// their own explicit, single-shot session handling (PKCE code exchange or,
// for legacy implicit links, a manual setSession() from the hash fragment —
// see AuthCallback.tsx / InviteActivationPage.tsx). Leaving it on makes the
// client ALSO auto-exchange the same code on construction, racing the
// component's manual call — this genuinely happened (two concurrent token
// exchanges for one code, and the automatic exchange's PASSWORD_RECOVERY
// notification firing before any component had subscribed, since
// AuthCallback is lazy-loaded and mounts after the client already
// initialized) and produced an intermittent false "expired link" error even
// on a valid link.
export const supabase = createClient(supabaseURL, supabaseDefaultKey, {
  auth: {
    flowType: "pkce",
    storageKey: supabaseAuthStorageKey,
    detectSessionInUrl: false,
  },
});
