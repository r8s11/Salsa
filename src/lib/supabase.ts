import { createClient } from "@supabase/supabase-js";

// Get enviorment variables
const supabaseURL = import.meta.env.VITE_SUPABASE_URL;
const supabaseDefaultKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Validate enviorment variables exist

if (!supabaseURL || !supabaseDefaultKey) {
    throw new Error(
        "Missing Supabase enviorment variables. Check your .env.local file"
    )
}

// Create and export Superbase client
export const supabase = createClient(supabaseURL, supabaseDefaultKey)
