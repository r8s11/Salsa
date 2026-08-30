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
// flowType "pkce" makes email-confirmation and future OAuth returns arrive at
// /auth/callback with a ?code= param exchanged via exchangeCodeForSession().
// detectSessionInUrl stays enabled so legacy implicit-hash tokens still work.
export const supabase = createClient(supabaseURL, supabaseDefaultKey, {
  auth: {
    flowType: "pkce",
    storageKey: supabaseAuthStorageKey,
    detectSessionInUrl: true,
  },
});
